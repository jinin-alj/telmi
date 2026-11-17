import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import RefreshToken, User
from app.models.common import as_utc
from app.security.tokens import InvalidTokenError, create_refresh_token, read_refresh_token

# Two browser tabs share one saved token and may both refresh at once; that isn't theft
REUSE_GRACE_SECONDS = 30


def issue_refresh_token(
    db: Session, user_id: uuid.UUID, settings: Settings, family_id: uuid.UUID | None = None
) -> str:
    """Store a new refresh token and return it signed; the caller commits."""
    now = datetime.now(UTC)
    # Expired tokens are of no use, so delete them (in the database only, nothing loaded in memory)
    db.execute(
        delete(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.expires_at < now)
        .execution_options(synchronize_session=False)
    )
    token_id = uuid.uuid4()
    if family_id is None:
        family_id = token_id
    db.add(
        RefreshToken(
            id=token_id,
            user_id=user_id,
            family_id=family_id,
            expires_at=now + timedelta(days=settings.refresh_token_days),
        )
    )
    return create_refresh_token(user_id, token_id, settings)


def revoke_family(db: Session, family_id: uuid.UUID) -> None:
    """End every token that came from the same sign-in; the caller commits."""
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
        .execution_options(synchronize_session=False)
    )


def used_recently(stored: RefreshToken) -> bool:
    """True when the token was swapped moments ago, as when two tabs refresh together."""
    if stored.used_at is None:
        return False
    used_seconds_ago = (datetime.now(UTC) - as_utc(stored.used_at)).total_seconds()
    return used_seconds_ago < REUSE_GRACE_SECONDS


def rotate_refresh_token(db: Session, token: str, settings: Settings) -> tuple[User, str]:
    """Swap a refresh token for a new one; replaying an old one ends the whole sign-in."""
    user_id, token_id = read_refresh_token(token, settings)
    stored = db.get(RefreshToken, token_id, with_for_update=True)
    if stored is None or stored.user_id != user_id or stored.revoked_at is not None:
        raise InvalidTokenError("Refresh token is not active")

    if stored.used_at is not None and not used_recently(stored):
        # Only someone holding a copy would send an old token again, so sign everyone out
        revoke_family(db, stored.family_id)
        db.commit()
        raise InvalidTokenError("Refresh token was already used")

    user = db.get(User, user_id)
    if user is None:
        raise InvalidTokenError("Account no longer exists")

    if stored.used_at is None:
        stored.used_at = datetime.now(UTC)
    new_token = issue_refresh_token(db, user_id, settings, stored.family_id)
    db.commit()
    return user, new_token


def revoke_refresh_token(db: Session, token: str, settings: Settings) -> None:
    """Sign a device out on the server; unknown or broken tokens are simply ignored."""
    try:
        _user_id, token_id = read_refresh_token(token, settings)
    except InvalidTokenError:
        return
    stored = db.get(RefreshToken, token_id)
    if stored is not None:
        revoke_family(db, stored.family_id)
        db.commit()
