import json

import httpx
import pytest

from app.ai.chat_model import ChatModelError
from app.ai.hosted_model import HostedChatModel
from app.ai.ollama_model import OllamaChatModel
from app.config import Settings, normalise_database_url
from app.dependencies import build_chat_model, build_vision_model


@pytest.mark.parametrize(
    "given, expected",
    [
        (
            "postgresql://user:secret@ep-cool-1.eu-central-1.aws.neon.tech/neondb?sslmode=require",
            "postgresql+psycopg://user:secret@ep-cool-1.eu-central-1.aws.neon.tech/neondb?sslmode=require",
        ),
        ("postgres://user:secret@host:5432/db", "postgresql+psycopg://user:secret@host:5432/db"),
        ("postgresql+psycopg://user:secret@host/db", "postgresql+psycopg://user:secret@host/db"),
        ("sqlite+pysqlite:///:memory:", "sqlite+pysqlite:///:memory:"),
    ],
)
def test_database_urls_from_hosts_use_psycopg(given: str, expected: str) -> None:
    assert normalise_database_url(given) == expected


def test_settings_normalise_the_database_url() -> None:
    settings = Settings(
        database_url="postgres://user:secret@host/db",
        jwt_secret="x" * 32,
    )

    assert settings.database_url == "postgresql+psycopg://user:secret@host/db"


def test_ollama_client_sends_the_gateway_key_when_set() -> None:
    model = OllamaChatModel(
        base_url="https://gateway.example",
        model_name="llama3.1:8b",
        timeout_seconds=5,
        context_tokens=8192,
        api_key="gateway-secret",
    )

    assert model.http_client.headers["Authorization"] == "Bearer gateway-secret"


def test_ollama_client_sends_no_key_for_local_ollama() -> None:
    model = OllamaChatModel(
        base_url="http://localhost:11434",
        model_name="llama3.1:8b",
        timeout_seconds=5,
        context_tokens=8192,
    )

    assert "Authorization" not in model.http_client.headers


def test_ollama_client_reports_a_rejected_key_as_a_model_error() -> None:
    def reject(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "unauthorised"})

    model = OllamaChatModel(
        base_url="https://gateway.example",
        model_name="llama3.1:8b",
        timeout_seconds=5,
        context_tokens=8192,
        api_key="wrong",
    )
    model.http_client = httpx.Client(
        base_url="https://gateway.example", transport=httpx.MockTransport(reject)
    )

    with pytest.raises(ChatModelError):
        model.complete([{"role": "user", "content": "Hi"}], temperature=0.0)


def hosted_settings(**overrides: object) -> Settings:
    """Settings for the always-on hosted AI, with any field overridable."""
    values: dict[str, object] = {
        "database_url": "sqlite+pysqlite:///:memory:",
        "jwt_secret": "x" * 32,
        "ai_provider": "hosted",
        "ai_api_key": "groq-key",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)  # type: ignore[arg-type]


def test_hosted_ai_needs_a_key() -> None:
    with pytest.raises(ValueError, match="AI_API_KEY"):
        hosted_settings(ai_api_key=None)


def test_hosted_ai_gives_pip_and_the_checker_their_own_models(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.dependencies.get_settings", lambda: hosted_settings())

    buddy = build_chat_model("openai/gpt-oss-20b", for_grading=False)
    checker = build_chat_model("openai/gpt-oss-120b", for_grading=True)

    assert isinstance(buddy, HostedChatModel)
    assert isinstance(checker, HostedChatModel)
    assert buddy.model_name == "openai/gpt-oss-20b"
    assert buddy.json_schema_supported is False
    assert buddy.reasoning_effort == "low"
    assert checker.model_name == "openai/gpt-oss-120b"
    assert checker.json_schema_supported is True
    assert checker.reasoning_effort == "low"


def test_local_development_still_uses_ollama(monkeypatch: pytest.MonkeyPatch) -> None:
    local = Settings(
        database_url="sqlite+pysqlite:///:memory:",
        jwt_secret="x" * 32,
        ai_provider="ollama",
        _env_file=None,
    )
    monkeypatch.setattr("app.dependencies.get_settings", lambda: local)

    assert isinstance(build_chat_model("any", for_grading=True), OllamaChatModel)


def test_ollama_sends_images_on_the_last_message() -> None:
    sent: list[dict[str, object]] = []

    def respond(request: httpx.Request) -> httpx.Response:
        sent.append(json.loads(request.content))
        return httpx.Response(200, json={"message": {"content": "H₂O"}})

    model = OllamaChatModel(
        base_url="http://localhost:11434",
        model_name="qwen2.5vl:7b",
        timeout_seconds=5,
        context_tokens=8192,
    )
    model.http_client = httpx.Client(
        base_url="http://localhost:11434", transport=httpx.MockTransport(respond)
    )

    model.complete([{"role": "user", "content": "Copy this"}], temperature=0, images=[b"png"])

    assert sent[0]["messages"] == [{"role": "user", "content": "Copy this", "images": ["cG5n"]}]


def test_vision_model_follows_the_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.dependencies.get_settings", lambda: hosted_settings(ai_vision_model="vision-x")
    )
    hosted = build_vision_model()

    local = Settings(
        database_url="sqlite+pysqlite:///:memory:",
        jwt_secret="x" * 32,
        ai_provider="ollama",
        ollama_vision_model="local-vision",
        _env_file=None,
    )
    monkeypatch.setattr("app.dependencies.get_settings", lambda: local)
    ollama = build_vision_model()

    assert isinstance(hosted, HostedChatModel)
    assert hosted.model_name == "vision-x"
    assert hosted.reasoning_effort is None
    assert isinstance(ollama, OllamaChatModel)
    assert ollama.model_name == "local-vision"
