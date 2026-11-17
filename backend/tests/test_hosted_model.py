import json
from typing import Any

import httpx
import pytest

from app.ai.chat_model import ChatModelError
from app.ai.hosted_model import HostedChatModel

SCHEMA: dict[str, Any] = {"type": "object", "properties": {"verdict": {"type": "string"}}}
MESSAGES = [{"role": "system", "content": "You grade."}, {"role": "user", "content": "Hi"}]


def model_with(
    responder: Any,
    json_schema_supported: bool = True,
    reasoning_effort: str | None = None,
) -> tuple[HostedChatModel, list[dict[str, Any]]]:
    """A hosted model whose HTTP calls go to a fake server; returns the requests it sent."""
    sent: list[dict[str, Any]] = []

    def handle(request: httpx.Request) -> httpx.Response:
        sent.append(
            {
                "path": request.url.path,
                "authorization": request.headers.get("Authorization"),
                "body": json.loads(request.content),
            }
        )
        result: httpx.Response = responder(request)
        return result

    model = HostedChatModel(
        base_url="https://api.example/openai/v1",
        api_key="secret-key",
        model_name="test-model",
        timeout_seconds=5,
        max_completion_tokens=500,
        json_schema_supported=json_schema_supported,
        reasoning_effort=reasoning_effort,
    )
    model.http_client = httpx.Client(
        base_url="https://api.example/openai/v1",
        headers=model.http_client.headers,
        transport=httpx.MockTransport(handle),
    )
    return model, sent


def reply(content: str) -> Any:
    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    return respond


def test_sends_a_chat_completion_with_the_key() -> None:
    model, sent = model_with(reply(" Why do plants need light? "))

    text = model.complete(MESSAGES, temperature=0.7)

    assert text == "Why do plants need light?"
    assert sent[0]["path"] == "/openai/v1/chat/completions"
    assert sent[0]["authorization"] == "Bearer secret-key"
    body = sent[0]["body"]
    assert body["model"] == "test-model"
    assert body["temperature"] == 0.7
    assert body["max_completion_tokens"] == 500
    assert "response_format" not in body
    assert "reasoning_effort" not in body


def test_asks_for_the_schema_when_the_model_supports_it() -> None:
    model, sent = model_with(reply('{"verdict": "correct"}'), reasoning_effort="low")

    model.complete(MESSAGES, temperature=0.0, response_schema=SCHEMA)

    body = sent[0]["body"]
    assert body["response_format"]["type"] == "json_schema"
    assert body["response_format"]["json_schema"]["schema"] == SCHEMA
    assert body["reasoning_effort"] == "low"
    assert body["include_reasoning"] is False
    assert body["messages"] == MESSAGES


def test_falls_back_to_json_mode_with_the_schema_in_the_prompt() -> None:
    model, sent = model_with(reply('{"verdict": "correct"}'), json_schema_supported=False)

    model.complete(MESSAGES, temperature=0.0, response_schema=SCHEMA)

    body = sent[0]["body"]
    assert body["response_format"] == {"type": "json_object"}
    assert "JSON" in body["messages"][0]["content"]
    assert json.dumps(SCHEMA) in body["messages"][0]["content"]
    # The caller's own message list must not be changed
    assert MESSAGES[0]["content"] == "You grade."


def test_rate_limit_becomes_a_model_error() -> None:
    def busy(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, headers={"retry-after": "20"}, json={"error": "slow down"})

    model, _sent = model_with(busy)

    with pytest.raises(ChatModelError, match="busy"):
        model.complete(MESSAGES, temperature=0.7)


def test_server_error_becomes_a_model_error() -> None:
    def broken(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "oops"})

    model, _sent = model_with(broken)

    with pytest.raises(ChatModelError):
        model.complete(MESSAGES, temperature=0.7)


@pytest.mark.parametrize("payload", [{}, {"choices": []}, {"choices": [{"message": {}}]}])
def test_unexpected_or_empty_replies_become_model_errors(payload: dict[str, Any]) -> None:
    def odd(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    model, _sent = model_with(odd)

    with pytest.raises(ChatModelError):
        model.complete(MESSAGES, temperature=0.7)


def test_blank_reply_is_a_model_error() -> None:
    model, _sent = model_with(reply("   "))

    with pytest.raises(ChatModelError):
        model.complete(MESSAGES, temperature=0.7)


def test_error_message_from_the_provider_is_kept_for_the_log() -> None:
    def missing_model(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": {"message": "model not found"}})

    model, _sent = model_with(missing_model)

    with pytest.raises(ChatModelError, match="404: model not found"):
        model.complete(MESSAGES, temperature=0.7)


def test_images_go_with_the_last_message_as_data_urls() -> None:
    model, sent = model_with(reply("H₂O"))

    model.complete(MESSAGES, temperature=0, images=[b"png-bytes"])

    messages = sent[0]["body"]["messages"]
    assert messages[0] == MESSAGES[0]
    assert messages[1]["content"] == [
        {"type": "text", "text": "Hi"},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,cG5nLWJ5dGVz"}},
    ]
    # The caller's messages are left as they were
    assert MESSAGES[1]["content"] == "Hi"
