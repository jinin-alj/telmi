from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User
from scripts.pilot_report import collect_report, format_report
from tests.fakes import FakeChatModel
from tests.helpers import checker_reply, enrolled_student_with_unit, finish_session, sign_up_as


def pilot_week(client: TestClient, fake_chat_model: FakeChatModel) -> None:
    """One teacher and student: a finished session with a spoken and a drawn turn, and a report."""
    student, unit_id = enrolled_student_with_unit(client)
    session = client.post("/sessions", json={"unit_id": unit_id}, headers=student).json()
    for text, mode in [("Plants make glucose.", "talk"), ("CO2 + H2O", "draw")]:
        fake_chat_model.queue_reply("Why?")
        client.post(
            f"/sessions/{session['id']}/turns",
            json={"text": text, "input_mode": mode},
            headers=student,
        )
    finish_session(client, fake_chat_model, student, session["id"], checker_reply([1, 2]))
    client.post("/sessions", json={"unit_id": unit_id}, headers=student)
    client.post(
        "/feedback",
        json={"message": "The mic stopped.", "page": "/session/abc", "app_version": "1.0.0"},
        headers=student,
    )


def test_counts_this_weeks_pilot_activity(
    client: TestClient, db: Session, fake_chat_model: FakeChatModel
) -> None:
    pilot_week(client, fake_chat_model)

    report = collect_report(db, days=7)

    assert report.new_students == 1
    assert report.new_teachers == 1
    assert report.classes_with_activity == 1
    assert report.sessions_started == 2
    assert report.sessions_finished == 1
    assert report.sessions_left_open == 1
    assert report.average_coverage_percent == 67
    assert report.turns_by_mode == {"talk": 1, "draw": 1}
    assert report.problem_reports == 1
    assert report.problem_pages == {"/session/abc": 1}


def test_leaves_out_anything_older_than_the_period(client: TestClient, db: Session) -> None:
    sign_up_as(client, "old_student", "student")
    for user in db.query(User).all():
        user.created_at = datetime.now(UTC) - timedelta(days=30)
    db.commit()

    report = collect_report(db, days=7)

    assert report.new_students == 0
    assert report.average_coverage_percent is None


def test_prints_a_short_readable_summary_without_anyones_words(
    client: TestClient, db: Session, fake_chat_model: FakeChatModel
) -> None:
    pilot_week(client, fake_chat_model)

    summary = format_report(collect_report(db, days=7))

    assert "Last 7 days" in summary
    assert "Sessions: 2 started, 1 finished, 1 left open" in summary
    assert "Answers: 1 spoken, 0 typed, 1 drawn" in summary
    # Report messages and student turns can hold personal details, so they're never printed
    assert "The mic stopped" not in summary
    assert "Plants make glucose" not in summary
