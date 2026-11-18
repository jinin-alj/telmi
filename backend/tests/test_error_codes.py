from pathlib import Path

from fastapi.testclient import TestClient

from app.ai.chat_model import ChatModelBusyError
from tests.fakes import FakeChatModel
from tests.helpers import TEST_PASSWORD, enrolled_student_with_unit, sign_up_as

APP_FOLDER = Path(__file__).parent.parent / "app"
# The only file allowed to build error responses, so every one of them carries a code
ERROR_FILE = APP_FOLDER / "api_errors.py"


def test_every_error_response_is_built_with_a_code() -> None:
    for source_file in APP_FOLDER.rglob("*.py"):
        if source_file == ERROR_FILE:
            continue
        source = source_file.read_text()
        assert "HTTPException(" not in source, source_file
        assert "JSONResponse(" not in source, source_file


def test_wrong_login_has_a_code_and_keeps_its_message(client: TestClient) -> None:
    response = client.post("/auth/login", json={"username": "nobody", "password": TEST_PASSWORD})

    assert response.status_code == 401
    assert response.json() == {"detail": "Wrong username or password", "code": "wrong_login"}


def test_taken_username_has_a_code(client: TestClient) -> None:
    sign_up_as(client, "ana_g", "student")

    response = client.post(
        "/auth/register",
        json={
            "username": "ana_g",
            "display_name": "Ana",
            "password": TEST_PASSWORD,
            "role": "student",
        },
    )

    assert response.status_code == 409
    assert response.json()["code"] == "username_taken"


def test_signed_out_and_wrong_role_have_codes(client: TestClient) -> None:
    student = sign_up_as(client, "ana_g", "student")

    assert client.get("/auth/me").json()["code"] == "not_signed_in"
    assert client.post("/classrooms", json={"name": "7B"}, headers=student).json()["code"] == (
        "teachers_only"
    )


def test_unknown_join_code_has_a_code(client: TestClient) -> None:
    student = sign_up_as(client, "ana_g", "student")

    response = client.post("/classrooms/join", json={"join_code": "ZZZZZZ"}, headers=student)

    assert response.status_code == 404
    assert response.json()["code"] == "unknown_join_code"


def test_finishing_with_nothing_said_has_a_code(client: TestClient) -> None:
    student, unit_id = enrolled_student_with_unit(client)
    session = client.post("/sessions", json={"unit_id": unit_id}, headers=student).json()

    response = client.post(f"/sessions/{session['id']}/finish", headers=student)

    assert response.status_code == 409
    assert response.json()["code"] == "nothing_explained"


def test_busy_pip_has_a_code_and_a_retry_time(
    client: TestClient, fake_chat_model: FakeChatModel
) -> None:
    student, unit_id = enrolled_student_with_unit(client)
    session = client.post("/sessions", json={"unit_id": unit_id}, headers=student).json()

    def rate_limited() -> None:
        raise ChatModelBusyError("The AI service is busy")

    fake_chat_model.while_thinking = rate_limited

    response = client.post(
        f"/sessions/{session['id']}/turns", json={"text": "Plants make food."}, headers=student
    )

    assert response.status_code == 503
    assert response.json()["code"] == "pip_busy"
    assert response.headers["Retry-After"] == "60"


def test_invalid_input_has_a_code_and_keeps_the_details(client: TestClient) -> None:
    response = client.post("/auth/login", json={"username": "ana_g"})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "invalid_input"
    # The app still reads the first problem's message from the list
    assert isinstance(body["detail"], list)
    assert body["detail"][0]["loc"] == ["body", "password"]


def test_too_big_request_has_a_code(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        content=b"x" * (200 * 1024),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 413
    assert response.json()["code"] == "request_too_large"
