from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import User
from app.schemas.auth import RegisterRequest
from app.security.passwords import (
    DUMMY_PASSWORD_HASH,
    hash_password,
    needs_rehash,
    verify_password,
)


class UsernameTakenError(Exception):
    """Raised when someone signs up with a username that already exists."""


def find_user_by_username(db: Session, username: str) -> User | None:
    """Look up one account by its lowercase username."""
    return db.scalar(select(User).where(User.username == username))


def register_user(db: Session, request: RegisterRequest) -> User:
    """Create a new account with a hashed password."""
    if find_user_by_username(db, request.username) is not None:
        raise UsernameTakenError(request.username)

    user = User(
        username=request.username,
        display_name=request.display_name,
        password_hash=hash_password(request.password),
        role=request.role,
    )
    db.add(user)

    # The unique index still catches two sign-ups racing for the same name
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise UsernameTakenError(request.username) from error

    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    """Return the user if the password matches, otherwise None."""
    user = find_user_by_username(db, username)
    if user is None:
        # Hash anyway so attackers can't tell real usernames from timing
        verify_password(password, DUMMY_PASSWORD_HASH)
        return None

    if not verify_password(password, user.password_hash):
        return None

    # Accounts made before the lighter settings move over the first time they sign in
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        db.commit()
    return user
