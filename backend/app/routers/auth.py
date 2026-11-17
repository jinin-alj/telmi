from fastapi import APIRouter, HTTPException, Request, status

from app.config import Settings
from app.dependencies import AppSettings, CurrentUser, DbSession, unauthorized
from app.models import User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    UserPublic,
)
from app.security.rate_limit import RateLimiter
from app.security.tokens import (
    REFRESH_TOKEN_TYPE,
    InvalidTokenError,
    create_access_token,
    create_refresh_token,
    read_user_id,
)
from app.services.accounts import UsernameTakenError, authenticate_user, register_user

router = APIRouter(prefix="/auth", tags=["auth"])

# Long enough to make guessing passwords slow, short enough not to lock out a real student
RETRY_AFTER_SECONDS = 60


def client_address(request: Request) -> str:
    """The caller's address; behind Render's proxy it can be faked, so it's only a rough limit."""
    if request.client is None:
        return "unknown"
    return request.client.host


def check_rate_limit(limiter: RateLimiter, key: str) -> None:
    """Answer 429 once this key has used up its attempts."""
    if not limiter.allow(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many tries. Wait a minute, then try again.",
            headers={"Retry-After": str(RETRY_AFTER_SECONDS)},
        )


def build_auth_response(user: User, settings: Settings) -> AuthResponse:
    """Issue a fresh access and refresh token for the user."""
    return AuthResponse(
        access_token=create_access_token(user.id, settings),
        refresh_token=create_refresh_token(user.id, settings),
        user=UserPublic.model_validate(user),
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest, http_request: Request, db: DbSession, settings: AppSettings
) -> AuthResponse:
    """Create an account and sign the user straight in."""
    check_rate_limit(http_request.app.state.sign_up_limiter, client_address(http_request))
    try:
        user = register_user(db, request)
    except UsernameTakenError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="That username is already taken"
        ) from error
    return build_auth_response(user, settings)


@router.post("/login")
def login(
    request: LoginRequest, http_request: Request, db: DbSession, settings: AppSettings
) -> AuthResponse:
    """Sign in with username and password."""
    limiters = http_request.app.state
    check_rate_limit(limiters.login_address_limiter, client_address(http_request))
    check_rate_limit(limiters.login_username_limiter, request.username)
    user = authenticate_user(db, request.username, request.password)
    if user is None:
        # Same message for unknown user and wrong password so usernames can't be probed
        raise unauthorized("Wrong username or password")
    return build_auth_response(user, settings)


@router.post("/refresh")
def refresh(request: RefreshRequest, db: DbSession, settings: AppSettings) -> AuthResponse:
    """Trade a valid refresh token for a new token pair."""
    try:
        user_id = read_user_id(request.refresh_token, REFRESH_TOKEN_TYPE, settings)
    except InvalidTokenError as error:
        raise unauthorized("Session expired, please log in again") from error

    user = db.get(User, user_id)
    if user is None:
        raise unauthorized("Account no longer exists")
    return build_auth_response(user, settings)


@router.get("/me")
def read_me(current_user: CurrentUser) -> UserPublic:
    """Return the signed-in user's profile."""
    return UserPublic.model_validate(current_user)
