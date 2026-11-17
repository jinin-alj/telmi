from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Feedback
from tests.helpers import sign_up_as

REPORT = {
    "message": "The microphone stopped after one sentence.",
    "page": "/session/abc",
    "app_version": "1.0.0",
}


def test_a_signed_in_user_can_report_a_problem(client: TestClient, db: Session) -> None:
    student = sign_up_as(client, "ana_g", "student")

    response = client.post("/feedback", json=REPORT, headers=student)

    assert response.status_code == 204
    saved = db.query(Feedback).one()
    assert saved.message == REPORT["message"]
    assert saved.page == "/session/abc"
    assert saved.app_version == "1.0.0"
    assert saved.role == "student"


def test_reports_need_a_signed_in_user(client: TestClient) -> None:
    assert client.post("/feedback", json=REPORT).status_code == 401


def test_reports_must_say_something_and_stay_short(client: TestClient) -> None:
    teacher = sign_up_as(client, "ms_lopez", "teacher")

    empty = client.post("/feedback", json={**REPORT, "message": "   "}, headers=teacher)
    too_long = client.post("/feedback", json={**REPORT, "message": "x" * 1001}, headers=teacher)

    assert empty.status_code == 422
    assert too_long.status_code == 422


def test_one_person_cannot_flood_the_reports(client: TestClient) -> None:
    student = sign_up_as(client, "ana_g", "student")
    statuses = []
    for _number in range(6):
        statuses.append(client.post("/feedback", json=REPORT, headers=student).status_code)

    assert statuses[:5] == [204] * 5
    assert statuses[5] == 429


def test_old_reports_are_deleted_after_six_months(client: TestClient, db: Session) -> None:
    student = sign_up_as(client, "ana_g", "student")
    client.post("/feedback", json=REPORT, headers=student)
    for saved in db.query(Feedback).all():
        saved.created_at = datetime.now(UTC) - timedelta(days=200)
    db.commit()

    client.post("/feedback", json=REPORT, headers=student)

    assert db.query(Feedback).count() == 1
