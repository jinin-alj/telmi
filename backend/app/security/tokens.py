import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.config import Settings

# Labels for the "type" claim, not secrets
ACCESS_TOKEN_TYPE = "access"  # noqa: S105
REFRESH_TOKEN_TYPE = "refresh"  # noqa: S105


class InvalidTokenError(Exception):
    """Raised when a token is expired, tampered with or of the wrong type."""


def create_token(
    user_id: uuid.UUID,
    token_type: str,
    lifetime: timedelta,
    settings: Settings,
    token_id: uuid.UUID | None = None,
) -> str:
    """Sign a JWT for one user with an expiry, a type claim and, for refresh tokens, an id."""
    issued_at = datetime.now(UTC)
    claims: dict[str, object] = {
        "sub": str(user_id),
        "type": token_type,
        "iat": issued_at,
        "exp": issued_at + lifetime,
    }
    if token_id is not None:
        claims["jti"] = str(token_id)
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: uuid.UUID, settings: Settings) -> str:
    """Short-lived token sent with every API request."""
    lifetime = timedelta(minutes=settings.access_token_minutes)
    return create_token(user_id, ACCESS_TOKEN_TYPE, lifetime, settings)


def create_refresh_token(user_id: uuid.UUID, token_id: uuid.UUID, settings: Settings) -> str:
    """Long-lived token used only to get a new access token; its id matches a stored row."""
    lifetime = timedelta(days=settings.refresh_token_days)
    return create_token(user_id, REFRESH_TOKEN_TYPE, lifetime, settings, token_id)


def read_claims(token: str, expected_type: str, settings: Settings) -> dict[str, str]:
    """Verify a token's signature, expiry and type, and return its claims."""
    try:
        # Pinning the algorithm list blocks the "alg: none" downgrade attack
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "type", "exp"]},
        )
    except jwt.PyJWTError as error:
        raise InvalidTokenError("Token could not be verified") from error

    if claims["type"] != expected_type:
        raise InvalidTokenError(f"Expected a {expected_type} token")
    return claims


def parse_id(value: str, what: str) -> uuid.UUID:
    """Turn an id from a token into a UUID, or refuse the token."""
    try:
        return uuid.UUID(value)
    except ValueError as error:
        raise InvalidTokenError(f"Token {what} is not a valid id") from error


def read_user_id(token: str, expected_type: str, settings: Settings) -> uuid.UUID:
    """Verify a token and return the user id inside it."""
    claims = read_claims(token, expected_type, settings)
    return parse_id(claims["sub"], "subject")


def read_refresh_token(token: str, settings: Settings) -> tuple[uuid.UUID, uuid.UUID]:
    """Verify a refresh token and return its user id and its own id."""
    claims = read_claims(token, REFRESH_TOKEN_TYPE, settings)
    # Tokens from before refresh tokens were stored have no id, so they can't be checked
    if "jti" not in claims:
        raise InvalidTokenError("Refresh token has no id")
    return parse_id(claims["sub"], "subject"), parse_id(claims["jti"], "id")
