import base64
import json
from typing import Any

import httpx

from app.ai.chat_model import ChatMessage, ChatModel, ChatModelError

RATE_LIMITED = 429


def add_schema_instruction(
    messages: list[ChatMessage], schema: dict[str, Any]
) -> list[ChatMessage]:
    """Add the JSON format to the prompt, as JSON mode needs; the caller's list is untouched."""
    instruction = (
        "Reply with a single JSON object only, matching this JSON schema exactly:\n"
        + json.dumps(schema)
    )
    copied = []
    for message in messages:
        copied.append(dict(message))
    if len(copied) > 0 and copied[0]["role"] == "system":
        copied[0]["content"] = copied[0]["content"] + "\n\n" + instruction
    else:
        copied.insert(0, {"role": "system", "content": instruction})
    return copied


def attach_images(messages: list[ChatMessage], images: list[bytes]) -> list[dict[str, Any]]:
    """Turn the last message into text plus images, in the OpenAI-compatible format."""
    attached: list[dict[str, Any]] = [dict(message) for message in messages]
    parts: list[dict[str, Any]] = [{"type": "text", "text": attached[-1]["content"]}]
    for image in images:
        encoded = base64.b64encode(image).decode("ascii")
        parts.append(
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{encoded}"}}
        )
    attached[-1]["content"] = parts
    return attached


def read_error_message(response: httpx.Response) -> str:
    """The provider's own explanation, such as "model not found", trimmed for the log."""
    try:
        message = response.json()["error"]["message"]
    except (KeyError, TypeError, ValueError):
        return "no details"
    return str(message)[:200]


class HostedChatModel(ChatModel):
    """Talks to any OpenAI-compatible chat API, such as Groq. Always on, unlike a laptop."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        model_name: str,
        timeout_seconds: float,
        max_completion_tokens: int,
        json_schema_supported: bool,
        reasoning_effort: str | None = None,
    ) -> None:
        self.model_name = model_name
        self.max_completion_tokens = max_completion_tokens
        self.json_schema_supported = json_schema_supported
        self.reasoning_effort = reasoning_effort
        # One shared client so connections are reused across requests
        self.http_client = httpx.Client(
            base_url=base_url,
            timeout=timeout_seconds,
            headers={"Authorization": f"Bearer {api_key}"},
        )

    def complete(
        self,
        messages: list[ChatMessage],
        temperature: float,
        response_schema: dict[str, Any] | None = None,
        images: list[bytes] | None = None,
    ) -> str:
        """Send the chat to the hosted model and return the reply text."""
        payload: dict[str, Any] = {
            "model": self.model_name,
            "messages": attach_images(messages, images) if images else messages,
            "temperature": temperature,
            "max_completion_tokens": self.max_completion_tokens,
        }
        if self.reasoning_effort is not None:
            # Reasoning models think before answering; low effort saves the free daily token budget
            payload["reasoning_effort"] = self.reasoning_effort
            payload["include_reasoning"] = False

        if response_schema is not None:
            if self.json_schema_supported:
                # Not strict: strict mode rejects keywords like maxLength; replies are validated
                payload["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {"name": "reply", "schema": response_schema, "strict": False},
                }
            else:
                payload["response_format"] = {"type": "json_object"}
                payload["messages"] = add_schema_instruction(messages, response_schema)

        try:
            response = self.http_client.post("/chat/completions", json=payload)
        except httpx.HTTPError as error:
            raise ChatModelError(f"AI service unreachable: {error}") from error

        if response.status_code == RATE_LIMITED:
            raise ChatModelError("The AI service is busy (free-tier rate limit)")
        if response.status_code >= 400:
            raise ChatModelError(
                f"AI service error {response.status_code}: {read_error_message(response)}"
            )

        try:
            reply_text = response.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise ChatModelError("The AI service returned an unexpected response") from error

        if not isinstance(reply_text, str) or reply_text.strip() == "":
            raise ChatModelError("The AI service returned an empty reply")
        return reply_text.strip()
