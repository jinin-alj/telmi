from datetime import timedelta
from typing import Any

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import User
from app.security.tokens import ACCESS_TOKEN_TYPE, create_token
from tests.helpers import auth_header


def sign_up(client: TestClient, **overrides: Any) -> Any:
    """Register a default student, with any field overridable."""
    form = {
        "username": "ana_g",
        "display_name": "Ana",
        "password": "correct-horse-battery",
        "role": "student",
    }
    form.update(overrides)
    return client.post("/auth/register", json=form)


def test_register_creates_account_and_returns_tokens(client: TestClient) -> None:
    response = sign_up(client)

    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"] != ""
    assert body["refresh_token"] != ""
    assert body["user"]["username"] == "ana_g"
    assert body["user"]["role"] == "student"
    assert "password_hash" not in body["user"]


def test_register_stores_an_argon2_hash_not_the_password(client: TestClient, db: Session) -> None:
    sign_up(client)

    user = db.query(User).one()
    assert user.password_hash != "correct-horse-battery"
    assert user.password_hash.startswith("$argon2id$")


def test_register_lowercases_and_trims_username(client: TestClient) -> None:
    response = sign_up(client, username="  Ana_G ")

    assert response.status_code == 201
    assert response.json()["user"]["username"] == "ana_g"


def test_register_rejects_duplicate_username_ignoring_case(client: TestClient) -> None:
    sign_up(client)

    response = sign_up(client, username="ANA_G")

    assert response.status_code == 409


def test_register_allows_teacher_role(client: TestClient) -> None:
    response = sign_up(client, username="ms_lopez", role="teacher")

    assert response.status_code == 201
    assert response.json()["user"]["role"] == "teacher"


@pytest.mark.parametrize(
    "field, bad_value",
    [
        ("username", "ab"),
        ("username", "has space"),
        ("username", "<script>"),
        ("username", "a" * 31),
        ("password", "short"),
        ("password", "x" * 129),
        ("display_name", "   "),
        ("role", "admin"),
    ],
)
def test_register_rejects_invalid_input(client: TestClient, field: str, bad_value: str) -> None:
    response = sign_up(client, **{field: bad_value})

    assert response.status_code == 422


def test_login_with_correct_password(client: TestClient) -> None:
    sign_up(client)

    response = client.post(
        "/auth/login", json={"username": "Ana_G", "password": "correct-horse-battery"}
    )

    assert response.status_code == 200
    assert response.json()["user"]["username"] == "ana_g"


def test_login_gives_same_error_for_wrong_password_and_unknown_user(client: TestClient) -> None:
    sign_up(client)

    wrong_password = client.post("/auth/login", json={"username": "ana_g", "password": "nope-nope"})
    unknown_user = client.post("/auth/login", json={"username": "nobody", "password": "nope-nope"})

    assert wrong_password.status_code == 401
    assert unknown_user.status_code == 401
    assert wrong_password.json() == unknown_user.json()


def test_me_returns_signed_in_user(client: TestClient) -> None:
    access_token = sign_up(client).json()["access_token"]

    response = client.get("/auth/me", headers=auth_header(access_token))

    assert response.status_code == 200
    assert response.json()["username"] == "ana_g"


def test_me_requires_a_token(client: TestClient) -> None:
    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_me_rejects_a_refresh_token(client: TestClient) -> None:
    refresh_token = sign_up(client).json()["refresh_token"]

    response = client.get("/auth/me", headers=auth_header(refresh_token))

    assert response.status_code == 401


def test_me_rejects_garbage_token(client: TestClient) -> None:
    response = client.get("/auth/me", headers=auth_header("not.a.jwt"))

    assert response.status_code == 401


def test_me_rejects_expired_token(client: TestClient, db: Session) -> None:
    sign_up(client)
    user = db.query(User).one()
    expired_token = create_token(user.id, ACCESS_TOKEN_TYPE, timedelta(seconds=-1), get_settings())

    response = client.get("/auth/me", headers=auth_header(expired_token))

    assert response.status_code == 401


def test_me_rejects_token_signed_with_another_secret(client: TestClient, db: Session) -> None:
    sign_up(client)
    user = db.query(User).one()
    other_settings = get_settings().model_copy(update={"jwt_secret": "x" * 40})
    forged_token = create_token(user.id, ACCESS_TOKEN_TYPE, timedelta(minutes=5), other_settings)

    response = client.get("/auth/me", headers=auth_header(forged_token))

    assert response.status_code == 401


def test_refresh_returns_new_working_tokens(client: TestClient) -> None:
    refresh_token = sign_up(client).json()["refresh_token"]

    response = client.post("/auth/refresh", json={"refresh_token": refresh_token})

    assert response.status_code == 200
    new_access_token = response.json()["access_token"]
    assert client.get("/auth/me", headers=auth_header(new_access_token)).status_code == 200


def test_refresh_rejects_an_access_token(client: TestClient) -> None:
    access_token = sign_up(client).json()["access_token"]

    response = client.post("/auth/refresh", json={"refresh_token": access_token})

    assert response.status_code == 401


def test_login_upgrades_a_password_hash_made_with_old_settings(
    client: TestClient, db: Session
) -> None:
    sign_up(client)
    user = db.query(User).one()
    heavy_hasher = PasswordHasher(memory_cost=65536, time_cost=3, parallelism=4)
    user.password_hash = heavy_hasher.hash("correct-horse-battery")
    db.commit()

    response = client.post(
        "/auth/login", json={"username": "ana_g", "password": "correct-horse-battery"}
    )

    assert response.status_code == 200
    db.refresh(user)
    assert "m=19456" in user.password_hash
