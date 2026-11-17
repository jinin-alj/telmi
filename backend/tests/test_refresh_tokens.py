from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import RefreshToken, User
from app.security.tokens import REFRESH_TOKEN_TYPE, create_token
from tests.helpers import TEST_PASSWORD


def sign_up(client: TestClient) -> Any:
    """Register a student and return the response body."""
    response = client.post(
        "/auth/register",
        json={
            "username": "ana_g",
            "display_name": "Ana",
            "password": TEST_PASSWORD,
            "role": "student",
        },
    )
    assert response.status_code == 201
    return response.json()


def refresh(client: TestClient, refresh_token: str) -> Any:
    """Trade a refresh token for a new pair."""
    return client.post("/auth/refresh", json={"refresh_token": refresh_token})


def mark_used_long_ago(db: Session) -> None:
    """Pretend every used token was used a while ago, outside the two-tab grace window."""
    for stored in db.query(RefreshToken).all():
        if stored.used_at is not None:
            stored.used_at = datetime.now(UTC) - timedelta(minutes=5)
    db.commit()


def test_each_refresh_gives_a_new_refresh_token(client: TestClient) -> None:
    first = sign_up(client)["refresh_token"]

    second = refresh(client, first)

    assert second.status_code == 200
    assert second.json()["refresh_token"] != first


def test_a_stolen_token_used_again_signs_out_every_copy(client: TestClient, db: Session) -> None:
    first = sign_up(client)["refresh_token"]
    second = refresh(client, first).json()["refresh_token"]
    mark_used_long_ago(db)

    # Someone replays the old token: both it and the newer one stop working
    replayed = refresh(client, first)
    after_replay = refresh(client, second)

    assert replayed.status_code == 401
    assert after_replay.status_code == 401


def test_two_tabs_refreshing_at_once_both_keep_working(client: TestClient) -> None:
    first = sign_up(client)["refresh_token"]

    tab_one = refresh(client, first)
    tab_two = refresh(client, first)

    assert tab_one.status_code == 200
    assert tab_two.status_code == 200


def test_sign_out_ends_the_session_on_the_server(client: TestClient) -> None:
    refresh_token = sign_up(client)["refresh_token"]

    signed_out = client.post("/auth/logout", json={"refresh_token": refresh_token})

    assert signed_out.status_code == 204
    assert refresh(client, refresh_token).status_code == 401


def test_signing_out_twice_or_with_a_bad_token_is_harmless(client: TestClient) -> None:
    refresh_token = sign_up(client)["refresh_token"]
    client.post("/auth/logout", json={"refresh_token": refresh_token})

    again = client.post("/auth/logout", json={"refresh_token": refresh_token})
    garbage = client.post("/auth/logout", json={"refresh_token": "not-a-token"})

    assert again.status_code == 204
    assert garbage.status_code == 204


def test_refresh_tokens_from_before_this_change_are_refused(
    client: TestClient, db: Session
) -> None:
    sign_up(client)
    user = db.query(User).one()
    # Old tokens carry no id, so they can't be checked against the stored list
    old_token = create_token(user.id, REFRESH_TOKEN_TYPE, timedelta(days=1), get_settings())

    assert refresh(client, old_token).status_code == 401


def test_expired_stored_tokens_are_cleaned_up(client: TestClient, db: Session) -> None:
    first = sign_up(client)["refresh_token"]
    for stored in db.query(RefreshToken).all():
        stored.expires_at = datetime.now(UTC) - timedelta(days=1)
    db.commit()

    client.post("/auth/login", json={"username": "ana_g", "password": TEST_PASSWORD})

    # Only the token from the new sign-in is kept
    assert db.query(RefreshToken).count() == 1
    assert refresh(client, first).status_code == 401
