from functools import lru_cache
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.ai.chat_model import ChatModel
from app.ai.hosted_model import HostedChatModel
from app.ai.ollama_model import OllamaChatModel
from app.config import Settings, get_settings
from app.database import get_db
from app.models import User, UserRole
from app.security.tokens import ACCESS_TOKEN_TYPE, InvalidTokenError, read_user_id

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def unauthorized(detail: str) -> HTTPException:
    """Build the 401 error the app treats as 'please log in again'."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    db: DbSession,
    settings: AppSettings,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    """Resolve the signed-in user from the Authorization header."""
    if credentials is None:
        raise unauthorized("Not signed in")

    try:
        user_id = read_user_id(credentials.credentials, ACCESS_TOKEN_TYPE, settings)
    except InvalidTokenError as error:
        raise unauthorized("Session expired or invalid") from error

    user = db.get(User, user_id)
    if user is None:
        raise unauthorized("Account no longer exists")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_teacher(current_user: CurrentUser) -> User:
    """Allow only teacher accounts."""
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teachers only")
    return current_user


def require_student(current_user: CurrentUser) -> User:
    """Allow only student accounts."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students only")
    return current_user


TeacherUser = Annotated[User, Depends(require_teacher)]
StudentUser = Annotated[User, Depends(require_student)]


# Pip says one to three sentences; the cap also covers the model's short hidden reasoning
BUDDY_MAX_TOKENS = 800


def build_chat_model(model_name: str, for_grading: bool) -> ChatModel:
    """Create the model client for Pip or for the checker, from the configured provider."""
    settings = get_settings()
    if settings.ai_provider == "hosted":
        if for_grading:
            max_tokens = settings.ai_checker_max_tokens
            json_schema_supported = settings.ai_checker_json_schema
        else:
            max_tokens = BUDDY_MAX_TOKENS
            json_schema_supported = False
        return HostedChatModel(
            base_url=settings.ai_base_url,
            api_key=settings.ai_api_key or "",
            model_name=model_name,
            timeout_seconds=settings.ai_timeout_seconds,
            max_completion_tokens=max_tokens,
            json_schema_supported=json_schema_supported,
            reasoning_effort=settings.ai_reasoning_effort or None,
        )

    # Locally, Pip and the checker share the one Ollama model
    return OllamaChatModel(
        base_url=settings.ollama_base_url,
        model_name=settings.ollama_model,
        timeout_seconds=settings.ollama_timeout_seconds,
        context_tokens=settings.ollama_context_tokens,
        api_key=settings.ollama_api_key,
    )


@lru_cache
def get_buddy_model() -> ChatModel:
    """Pip's model, one shared client per process; tests swap in a fake."""
    return build_chat_model(get_settings().ai_buddy_model, for_grading=False)


@lru_cache
def get_checker_model() -> ChatModel:
    """The grading model, one shared client per process; tests swap in a fake."""
    return build_chat_model(get_settings().ai_checker_model, for_grading=True)


# A transcription is a line or two of text; the cap only guards against runaway replies
VISION_MAX_TOKENS = 600


def build_vision_model() -> ChatModel:
    """Create the model client that reads scratchpad drawings, from the configured provider."""
    settings = get_settings()
    if settings.ai_provider == "hosted":
        return HostedChatModel(
            base_url=settings.ai_base_url,
            api_key=settings.ai_api_key or "",
            model_name=settings.ai_vision_model,
            timeout_seconds=settings.ai_timeout_seconds,
            max_completion_tokens=VISION_MAX_TOKENS,
            json_schema_supported=False,
            # Copying out handwriting needs no reasoning, and not every vision model accepts it
            reasoning_effort=None,
        )

    return OllamaChatModel(
        base_url=settings.ollama_base_url,
        model_name=settings.ollama_vision_model,
        timeout_seconds=settings.ollama_timeout_seconds,
        context_tokens=settings.ollama_context_tokens,
        api_key=settings.ollama_api_key,
    )


@lru_cache
def get_vision_model() -> ChatModel:
    """The drawing reader, one shared client per process; tests swap in a fake."""
    return build_vision_model()


BuddyModel = Annotated[ChatModel, Depends(get_buddy_model)]
CheckerModel = Annotated[ChatModel, Depends(get_checker_model)]
VisionModel = Annotated[ChatModel, Depends(get_vision_model)]
