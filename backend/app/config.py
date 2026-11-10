from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Hosted databases (Neon, Supabase, Render) hand out URLs in these forms
PLAIN_POSTGRES_PREFIXES = ("postgres://", "postgresql://")
PSYCOPG_PREFIX = "postgresql+psycopg://"


def normalise_database_url(database_url: str) -> str:
    """Point plain Postgres URLs at the psycopg 3 driver this app uses."""
    for prefix in PLAIN_POSTGRES_PREFIXES:
        if database_url.startswith(prefix):
            return PSYCOPG_PREFIX + database_url[len(prefix) :]
    return database_url


class Settings(BaseSettings):
    """Runtime configuration read from environment variables or the repo-level .env file."""

    # The backend runs from backend/, so also look one folder up for the shared .env
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str
    # Free hosted databases allow few connections, so keep the pool small
    database_pool_size: int = Field(default=5, gt=0)
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = Field(default=30, gt=0)
    refresh_token_days: int = Field(default=30, gt=0)
    cors_origins: str = "http://localhost:8081"

    ollama_base_url: str = "http://localhost:11434"
    # Sent as a bearer token so only this backend can use the laptop's AI gateway
    ollama_api_key: str | None = None
    ollama_model: str = "llama3.1:8b"
    # Reads students' scratchpad drawings; must be a model that accepts images
    ollama_vision_model: str = "qwen2.5vl:7b"
    ollama_timeout_seconds: float = Field(default=120.0, gt=0)
    # Ollama's default context window is too small for material plus a full conversation
    ollama_context_tokens: int = Field(default=8192, gt=0)

    # "ollama" for local development; "hosted" for an always-on OpenAI-compatible API such as Groq
    ai_provider: Literal["ollama", "hosted"] = "ollama"
    ai_base_url: str = "https://api.groq.com/openai/v1"
    ai_api_key: str | None = None
    ai_timeout_seconds: float = Field(default=60.0, gt=0)
    # A fast model keeps Pip's replies quick; grading uses a stronger one
    ai_buddy_model: str = "openai/gpt-oss-20b"
    ai_checker_model: str = "openai/gpt-oss-120b"
    # Reads students' scratchpad drawings into text; must accept images. Swap it freely: the
    # prompt lives in app/ai/drawing.py, not in the provider (see "Scratchpad" in the README)
    ai_vision_model: str = "qwen/qwen3.8-27b"
    # Groq's gpt-oss models accept a JSON schema; set false for models that only do plain JSON
    ai_checker_json_schema: bool = True
    # Both gpt-oss models reason before answering; low effort keeps that short and saves the
    # free daily token budget. Set it empty for models that do not reason.
    ai_reasoning_effort: str | None = "low"
    # Free tiers count this cap against tokens per minute, so keep it modest
    ai_checker_max_tokens: int = Field(default=2048, gt=0)

    # Short, capped sessions keep the app from becoming more screen time
    session_minutes: int = Field(default=15, gt=0)
    max_student_turns: int = Field(default=8, gt=0)

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        """Accept the URL exactly as the database host shows it."""
        return normalise_database_url(value)

    @model_validator(mode="after")
    def require_key_for_hosted_ai(self) -> "Settings":
        """Fail at startup, not mid-demo, when the hosted AI has no key."""
        if self.ai_provider == "hosted" and not self.ai_api_key:
            raise ValueError("AI_API_KEY is required when AI_PROVIDER is hosted")
        return self

    def cors_origin_list(self) -> list[str]:
        """Split the comma-separated CORS_ORIGINS value into a list."""
        origins = []
        for origin in self.cors_origins.split(","):
            if origin.strip() != "":
                origins.append(origin.strip())
        return origins


@lru_cache
def get_settings() -> Settings:
    """Load settings once per process."""
    return Settings()
