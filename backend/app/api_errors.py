from collections.abc import Mapping

from fastapi import HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.services.errors import AppError, ErrorCode


class ApiError(HTTPException):
    """An error response with a fixed code, so the app can show it in the person's language."""

    def __init__(
        self,
        status_code: int,
        code: ErrorCode,
        message: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=message, headers=headers)
        self.code: ErrorCode = code


def api_error_for(status_code: int, error: AppError) -> ApiError:
    """Turn a service error into a response with the same code and message."""
    return ApiError(status_code, error.code, str(error))


def error_json(
    status_code: int, code: ErrorCode, message: str, headers: Mapping[str, str] | None = None
) -> JSONResponse:
    """How every error is sent: the English message, which older apps show, and the code."""
    return JSONResponse({"detail": message, "code": code}, status_code=status_code, headers=headers)


async def send_api_error(request: Request, error: Exception) -> JSONResponse:
    """Send an ApiError with its code next to its message."""
    if not isinstance(error, ApiError):
        raise error
    return error_json(error.status_code, error.code, str(error.detail), error.headers)


async def send_validation_error(request: Request, error: Exception) -> JSONResponse:
    """Answer bad input the way FastAPI does, listing each problem, plus a code for the app."""
    if not isinstance(error, RequestValidationError):
        raise error
    return JSONResponse(
        {"detail": jsonable_encoder(error.errors()), "code": "invalid_input"},
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
    )
