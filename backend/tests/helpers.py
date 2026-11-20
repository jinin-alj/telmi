import json
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import StudySession
from tests.fakes import FakeChatModel

TEST_PASSWORD = "correct-horse-battery"

MATERIAL = (
    "Photosynthesis happens in the chloroplasts of plant cells. Plants take in carbon dioxide "
    "and water, and use energy from sunlight to make glucose. Oxygen is released as a by-product."
)


def auth_header(token: str) -> dict[str, str]:
    """Authorization header for a bearer token."""
    return {"Authorization": f"Bearer {token}"}


def sign_up_as(client: TestClient, username: str, role: str) -> dict[str, str]:
    """Register an account and return its auth header."""
    response = client.post(
        "/auth/register",
        json={
            "username": username,
            "display_name": username,
            "password": TEST_PASSWORD,
            "role": role,
        },
    )
    assert response.status_code == 201
    return auth_header(response.json()["access_token"])


def create_class_with_unit(client: TestClient, teacher: dict[str, str]) -> tuple[str, str, str]:
    """Create a class and one unit; return the class id, join code and unit id."""
    classroom = client.post(
        "/classrooms", json={"name": "Biology 3A", "subject": "Biology"}, headers=teacher
    ).json()
    unit = client.post(
        f"/classrooms/{classroom['id']}/units",
        json={"title": "Photosynthesis", "material": MATERIAL},
        headers=teacher,
    ).json()
    return classroom["id"], classroom["join_code"], unit["id"]


def enrolled_student_with_unit(client: TestClient) -> tuple[dict[str, str], str]:
    """A teacher's class with a unit, joined by a student; return the student header and unit id."""
    teacher = sign_up_as(client, "ms_lopez", "teacher")
    student = sign_up_as(client, "ana_g", "student")
    _classroom_id, join_code, unit_id = create_class_with_unit(client, teacher)
    client.post("/classrooms/join", json={"join_code": join_code}, headers=student)
    return student, unit_id


KEY_IDEAS = [
    "Photosynthesis happens in the chloroplasts",
    "Plants use carbon dioxide, water and sunlight to make glucose",
    "Oxygen is released as a by-product",
]
KEY_IDEAS_REPLY = json.dumps({"key_ideas": KEY_IDEAS})

APPLICATION_REPLY = json.dumps(
    {"verdict": "partly_correct", "explanation": "Right idea about light; also mention glucose."}
)


MISCONCEPTION_SAID = "Plants get their food from the soil"

# KEY_IDEAS as the checker restates them for a student who explained in Spanish
SPANISH_KEY_IDEAS = [
    "La fotosíntesis ocurre en los cloroplastos",
    "Las plantas usan dióxido de carbono, agua y luz solar para fabricar glucosa",
    "El oxígeno se libera como subproducto",
]


def field_values(items: list[dict[str, Any]], field: str) -> list[Any]:
    """One field from each item of a JSON list, in order."""
    values = []
    for item in items:
        values.append(item[field])
    return values


def checker_reply(
    covered_numbers: list[int],
    misconception_idea: int | None = 2,
    student_said: str = MISCONCEPTION_SAID,
    restated_ideas: list[str] | None = None,
) -> str:
    """A checker verdict covering these 1-based ideas, with one misconception."""
    idea_results = []
    for idea_number in range(1, len(KEY_IDEAS) + 1):
        status = "covered" if idea_number in covered_numbers else "missing"
        idea_results.append({"idea_number": idea_number, "status": status})
    return json.dumps(
        {
            "idea_results": idea_results,
            "misconceptions": [
                {
                    "student_said": student_said,
                    "correction": "Plants make glucose using energy from sunlight",
                    "idea_number": misconception_idea,
                }
            ],
            "application_question": "Why does a plant kept in the dark stop growing?",
            "next_step": "Explain what happens to the oxygen made in photosynthesis.",
            # A student who spoke the material's language gets the ideas back word for word
            "key_ideas_in_student_language": KEY_IDEAS
            if restated_ideas is None
            else restated_ideas,
        }
    )


def finish_session(
    client: TestClient,
    fake_chat_model: FakeChatModel,
    student: dict[str, str],
    session_id: object,
    verdict: str,
    first_on_unit: bool = True,
) -> httpx.Response:
    """Finish a session; the first finish on a unit also extracts its key ideas."""
    if first_on_unit:
        fake_chat_model.queue_reply(KEY_IDEAS_REPLY)
    fake_chat_model.queue_reply(verdict)
    response: httpx.Response = client.post(f"/sessions/{session_id}/finish", headers=student)
    return response


def run_out_of_time(db: Session, study_session: StudySession) -> None:
    """Move a session's start an hour back, so its time is up."""
    study_session.started_at = datetime.now(UTC) - timedelta(hours=1)
    db.commit()


def change_settings(client: TestClient, changes: dict[str, int]) -> None:
    """Make the app use its normal settings with these values changed."""
    changed = get_settings().model_copy(update=changes)

    def changed_settings() -> Settings:
        return changed

    app = client.app
    assert isinstance(app, FastAPI)
    app.dependency_overrides[get_settings] = changed_settings
