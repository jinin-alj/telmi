from abc import ABC, abstractmethod
from typing import Any

# One message in a chat: {"role": "system" | "user" | "assistant", "content": "..."}
ChatMessage = dict[str, str]


class ChatModelError(Exception):
    """Raised when the language model can't be reached or returns something unusable."""


class ChatModel(ABC):
    """Any language model the app can talk to. Swap Ollama for a hosted model by subclassing."""

    @abstractmethod
    def complete(
        self,
        messages: list[ChatMessage],
        temperature: float,
        response_schema: dict[str, Any] | None = None,
        images: list[bytes] | None = None,
    ) -> str:
        """Return the model's reply text; with a schema, the reply must be JSON matching it.

        Images are PNG bytes shown with the last message; only vision models accept them.
        """
