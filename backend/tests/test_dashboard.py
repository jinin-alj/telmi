from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import SessionStatus, StudySession, User
from app.services.dashboard import calculate_mascot
from tests.fakes import FakeChatModel
from tests.helpers import (
    KEY_IDEAS,
    MISCONCEPTION_SAID,
    SPANISH_KEY_IDEAS,
    checker_reply,
    create_class_with_unit,
    field_values,
    finish_session,
    run_out_of_time,
    sign_up_as,
)


def run_session(
    client: TestClient,
    fake_chat_model: FakeChatModel,
    student: dict[str, str],
    unit_id: str,
    covered_numbers: list[int],
    first_on_unit: bool,
    misconception_idea: int | None = 2,
    restated_ideas: list[str] | None = None,
) -> None:
    """Start, speak once and finish a session with a chosen verdict."""
    session = client.post("/sessions", json={"unit_id": unit_id}, headers=student).json()
    fake_chat_model.queue_reply("Why?")
    client.post(
        f"/sessions/{session['id']}/turns", json={"text": MISCONCEPTION_SAID}, headers=student
    )
    verdict = checker_reply(covered_numbers, misconception_idea, restated_ideas=restated_ideas)
    response = finish_session(
        client, fake_chat_model, student, session["id"], verdict, first_on_unit
    )
    assert response.status_code == 200


def class_with_two_students(client: TestClient) -> dict[str, Any]:
    """A class with one unit and two students, Bea and Ana, who have not studied yet."""
    teacher = sign_up_as(client, "ms_lopez", "teacher")
    # Bea signs up first so the test can check the list is sorted by name, not sign-up order
    bea = sign_up_as(client, "bea_m", "student")
    ana = sign_up_as(client, "ana_g", "student")
    classroom_id, join_code, unit_id = create_class_with_unit(client, teacher)
    for student in [bea, ana]:
        client.post("/classrooms/join", json={"join_code": join_code}, headers=student)
    return {
        "teacher": teacher,
        "ana": ana,
        "bea": bea,
        "classroom_id": classroom_id,
        "unit_id": unit_id,
    }


def studied_class(client: TestClient, fake_chat_model: FakeChatModel) -> dict[str, Any]:
    """Ana covers ideas 1-2 once; Bea covers idea 1, then all three ideas."""
    setup = class_with_two_students(client)
    unit_id = setup["unit_id"]
    run_session(client, fake_chat_model, setup["ana"], unit_id, [1, 2], first_on_unit=True)
    run_session(client, fake_chat_model, setup["bea"], unit_id, [1], first_on_unit=False)
    run_session(
        client, fake_chat_model, setup["bea"], unit_id, [1, 2, 3], False, misconception_idea=None
    )
    return setup


def read_dashboard(client: TestClient, setup: dict[str, Any]) -> Any:
    """The teacher's dashboard JSON."""
    response = client.get(
        f"/classrooms/{setup['classroom_id']}/dashboard", headers=setup["teacher"]
    )
    assert response.status_code == 200
    return response.json()


def test_dashboard_before_anyone_studies(client: TestClient) -> None:
    setup = class_with_two_students(client)

    dashboard = read_dashboard(client, setup)

    assert dashboard["student_count"] == 2
    assert dashboard["units"][0]["students_attempted"] == 0
    assert dashboard["units"][0]["average_coverage_percent"] is None
    assert dashboard["units"][0]["ideas"] is None
    assert dashboard["students"][0]["units"][0]["sessions_completed"] == 0


def test_dashboard_lists_students_by_name_not_score(
    client: TestClient, fake_chat_model: FakeChatModel
) -> None:
    setup = studied_class(client, fake_chat_model)

    dashboard = read_dashboard(client, setup)

    assert field_values(dashboard["students"], "username") == ["ana_g", "bea_m"]


def test_dashboard_uses_each_students_latest_session(
    client: TestClient, fake_chat_model: FakeChatModel
) -> None:
    setup = studied_class(client, fake_chat_model)

    dashboard = read_dashboard(client, setup)

    ana, bea = dashboard["students"]
    assert ana["units"][0]["latest_coverage_percent"] == 67
    assert ana["units"][0]["missing_ideas"] == [KEY_IDEAS[2]]
    assert bea["units"][0]["sessions_completed"] == 2
    assert bea["units"][0]["latest_coverage_percent"] == 100
    assert bea["average_coverage_percent"] == 100
    assert dashboard["units"][0]["students_attempted"] == 2
    assert dashboard["units"][0]["average_coverage_percent"] == 84


def test_dashboard_tallies_each_key_idea_and_misconceptions(
    client: TestClient, fake_chat_model: FakeChatModel
) -> None:
    setup = studied_class(client, fake_chat_model)

    unit = read_dashboard(client, setup)["units"][0]

    first_idea, second_idea, third_idea = unit["ideas"]
    assert first_idea["idea"] == KEY_IDEAS[0]
    assert first_idea["students_covered"] == 2
    assert third_idea["students_covered"] == 1
    assert third_idea["students_missing"] == 1
    assert second_idea["misconception_count"] == 1
    assert second_idea["examples"][0]["student_said"] == "Plants get their food from the soil"
    assert "ana_g" not in str(second_idea["examples"])
    assert len(unit["other_misconceptions"]) == 1


def test_only_the_owner_teacher_sees_the_dashboard(client: TestClient) -> None:
    setup = class_with_two_students(client)
    other_teacher = sign_up_as(client, "mr_ruiz", "teacher")
    url = f"/classrooms/{setup['classroom_id']}/dashboard"

    assert client.get(url, headers=other_teacher).status_code == 404
    assert client.get(url, headers=setup["ana"]).status_code == 403


def test_progress_counts_distinct_ideas_understood(
    client: TestClient, fake_chat_model: FakeChatModel
) -> None:
    setup = studied_class(client, fake_chat_model)

    progress = client.get("/progress/me", headers=setup["bea"]).json()

    unit = progress["classrooms"][0]["units"][0]
    assert unit["sessions_completed"] == 2
    assert unit["best_coverage_percent"] == 100
    assert unit["ideas_understood"] == 3
    assert unit["total_ideas"] == 3
    assert unit["still_missing"] == []
    assert progress["mascot"] == {"level": 1, "understood_ideas": 3, "ideas_to_next_level": 2}


def test_progress_shows_latest_gaps_and_next_step(
    client: TestClient, fake_chat_model: FakeChatModel
) -> None:
    setup = studied_class(client, fake_chat_model)

    unit = client.get("/progress/me", headers=setup["ana"]).json()["classrooms"][0]["units"][0]

    assert unit["latest_coverage_percent"] == 67
    assert unit["still_missing"] == [KEY_IDEAS[2]]
    assert unit["next_step"].startswith("Explain what happens")


def test_progress_for_student_with_no_classes(client: TestClient) -> None:
    student = sign_up_as(client, "new_kid", "student")

    progress = client.get("/progress/me", headers=student).json()

    assert progress == {
        "mascot": {"level": 1, "understood_ideas": 0, "ideas_to_next_level": 5},
        "classrooms": [],
    }


def test_teacher_has_no_student_progress(client: TestClient) -> None:
    teacher = sign_up_as(client, "ms_lopez", "teacher")

    assert client.get("/progress/me", headers=teacher).status_code == 403


def test_mascot_levels_up_every_five_ideas() -> None:
    assert calculate_mascot(4).level == 1
    assert calculate_mascot(5).level == 2
    assert calculate_mascot(5).ideas_to_next_level == 5
    assert calculate_mascot(12).level == 3
    assert calculate_mascot(12).ideas_to_next_level == 3


def test_dashboard_counts_sessions_left_unfinished(
    client: TestClient, db: Session, fake_chat_model: FakeChatModel
) -> None:
    setup = class_with_two_students(client)
    unit_id = setup["unit_id"]
    run_session(client, fake_chat_model, setup["ana"], unit_id, [1, 2], first_on_unit=True)
    # Bea starts but closes the app, and her time runs out
    client.post("/sessions", json={"unit_id": unit_id}, headers=setup["bea"])
    # A session still within its time is not counted yet
    client.post("/sessions", json={"unit_id": unit_id}, headers=setup["ana"])
    bea = db.query(User).filter(User.username == "bea_m").one()
    bea_session = (
        db.query(StudySession)
        .filter(StudySession.student_id == bea.id, StudySession.status == SessionStatus.ACTIVE)
        .one()
    )
    run_out_of_time(db, bea_session)

    body = read_dashboard(client, setup)

    assert body["units"][0]["unfinished_sessions"] == 1


def test_spanish_speaker_sees_spanish_gaps_and_teacher_sees_the_materials_words(
    client: TestClient, fake_chat_model: FakeChatModel
) -> None:
    setup = class_with_two_students(client)
    run_session(
        client,
        fake_chat_model,
        setup["ana"],
        setup["unit_id"],
        [1, 2],
        first_on_unit=True,
        restated_ideas=SPANISH_KEY_IDEAS,
    )

    progress = client.get("/progress/me", headers=setup["ana"]).json()
    dashboard = client.get(
        f"/classrooms/{setup['classroom_id']}/dashboard", headers=setup["teacher"]
    ).json()

    assert progress["classrooms"][0]["units"][0]["still_missing"] == [SPANISH_KEY_IDEAS[2]]
    ana = dashboard["students"][0]
    assert ana["units"][0]["missing_ideas"] == [KEY_IDEAS[2]]
