from typing import Any

from app.ai.chat_model import ChatMessage, ChatModel, ChatModelError


class FakeChatModel(ChatModel):
    """Returns queued replies in order and records every request, so tests need no real model."""

    def __init__(self) -> None:
        self.queued_replies: list[str] = []
        self.requests: list[dict[str, Any]] = []

    def queue_reply(self, reply_text: str) -> None:
        """Add the next reply the fake will return."""
        self.queued_replies.append(reply_text)

    def complete(
        self,
        messages: list[ChatMessage],
        temperature: float,
        response_schema: dict[str, Any] | None = None,
        images: list[bytes] | None = None,
    ) -> str:
        """Record the request and return the next queued reply."""
        self.requests.append(
            {
                "messages": messages,
                "temperature": temperature,
                "schema": response_schema,
                "images": images,
            }
        )
        if len(self.queued_replies) == 0:
            raise ChatModelError("No fake reply queued")
        return self.queued_replies.pop(0)
