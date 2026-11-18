from typing import Literal

# A fixed name for every error a person can see; the app shows each one in their language
ErrorCode = Literal[
    # Accounts and signing in
    "username_taken",
    "wrong_login",
    "not_signed_in",
    "session_expired",
    "account_gone",
    "teachers_only",
    "students_only",
    "too_many_tries",
    # Classes and units
    "class_not_found",
    "unknown_join_code",
    "join_code_failed",
    "unit_not_found",
    # Teachers' material files
    "file_too_large",
    "file_unsupported",
    "file_locked",
    "file_damaged",
    "file_no_text",
    # Study sessions
    "session_not_found",
    "session_finished",
    "time_up",
    "last_turn",
    "session_full",
    "answer_already_sent",
    "nothing_explained",
    "finish_first",
    "nothing_to_answer",
    "drawings_used_up",
    "no_writing_found",
    "pip_busy",
    "pip_down",
    "drawing_unavailable",
    # Requests the app should never send
    "invalid_input",
    "request_too_large",
    "length_required",
]


class AppError(Exception):
    """An error a person can see: a fixed code for the app and an English message for logs."""

    def __init__(self, code: ErrorCode, message: str) -> None:
        super().__init__(message)
        self.code: ErrorCode = code


class NotFoundError(AppError):
    """The thing doesn't exist, or this user isn't allowed to know it exists."""


class ConflictError(AppError):
    """The request can't happen in the current state, for example a finished session."""
