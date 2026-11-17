"""Print the pilot's weekly numbers from the database; run from backend/ with DATABASE_URL set."""

import argparse
import os
from datetime import UTC, datetime, timedelta

# The report signs nothing, but loading the app's tables also loads its settings, which need these
os.environ.setdefault("JWT_SECRET", "report-only-not-used-for-signing-anything")
os.environ.setdefault("AI_PROVIDER", "ollama")

from pydantic import BaseModel  # noqa: E402
from sqlalchemy import create_engine, func, select, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.config import normalise_database_url  # noqa: E402
from app.models import (  # noqa: E402
    Feedback,
    SessionStatus,
    SessionTurn,
    Speaker,
    StudySession,
    Unit,
    User,
    UserRole,
)

# How each answer mode is named in the printed summary
MODE_NAMES = {"talk": "spoken", "type": "typed", "draw": "drawn"}


class PilotReport(BaseModel):
    """The numbers the team looks at each week of the pilot; never anyone's words."""

    days: int
    new_students: int
    new_teachers: int
    classes_with_activity: int
    sessions_started: int
    sessions_finished: int
    sessions_left_open: int
    average_coverage_percent: int | None
    turns_by_mode: dict[str, int]
    drawing_reads: int
    problem_reports: int
    problem_pages: dict[str, int]


def count_new_accounts(db: Session, role: UserRole, since: datetime) -> int:
    """Accounts with this role created since the start of the period."""
    query = select(func.count(User.id)).where(User.role == role, User.created_at >= since)
    return db.scalar(query) or 0


def count_turns_by_mode(db: Session, since: datetime) -> dict[str, int]:
    """Student answers in the period, by how they were given."""
    query = (
        select(SessionTurn.input_mode, func.count(SessionTurn.id))
        .where(SessionTurn.speaker == Speaker.STUDENT, SessionTurn.created_at >= since)
        .group_by(SessionTurn.input_mode)
    )
    counts: dict[str, int] = {}
    for mode, number in db.execute(query):
        if mode is None:
            counts["not recorded"] = number
        else:
            counts[mode] = number
    return counts


def count_problem_pages(db: Session, since: datetime) -> dict[str, int]:
    """Problem reports in the period, by the page they came from."""
    query = (
        select(Feedback.page, func.count(Feedback.id))
        .where(Feedback.created_at >= since)
        .group_by(Feedback.page)
    )
    pages: dict[str, int] = {}
    for page, number in db.execute(query):
        pages[page] = number
    return pages


def collect_report(db: Session, days: int) -> PilotReport:
    """Count what happened in the last few days, reading the database only."""
    since = datetime.now(UTC) - timedelta(days=days)
    started_in_period = StudySession.started_at >= since

    started = select(func.count(StudySession.id)).where(started_in_period)
    finished = select(func.count(StudySession.id)).where(
        started_in_period, StudySession.status == SessionStatus.COMPLETED
    )
    left_open = select(func.count(StudySession.id)).where(
        started_in_period, StudySession.status == SessionStatus.ACTIVE
    )
    average = select(func.avg(StudySession.coverage_percent)).where(
        started_in_period, StudySession.status == SessionStatus.COMPLETED
    )
    drawings = select(func.sum(StudySession.drawing_reads)).where(started_in_period)
    active_classes = (
        select(func.count(func.distinct(Unit.classroom_id)))
        .join(StudySession, StudySession.unit_id == Unit.id)
        .where(started_in_period)
    )
    average_coverage = db.scalar(average)
    average_percent = None
    if average_coverage is not None:
        average_percent = round(float(average_coverage))

    problem_pages = count_problem_pages(db, since)
    problem_reports = 0
    for number in problem_pages.values():
        problem_reports += number

    return PilotReport(
        days=days,
        new_students=count_new_accounts(db, UserRole.STUDENT, since),
        new_teachers=count_new_accounts(db, UserRole.TEACHER, since),
        classes_with_activity=db.scalar(active_classes) or 0,
        sessions_started=db.scalar(started) or 0,
        sessions_finished=db.scalar(finished) or 0,
        sessions_left_open=db.scalar(left_open) or 0,
        average_coverage_percent=average_percent,
        turns_by_mode=count_turns_by_mode(db, since),
        drawing_reads=db.scalar(drawings) or 0,
        problem_reports=problem_reports,
        problem_pages=problem_pages,
    )


def format_report(report: PilotReport) -> str:
    """The report as a few plain sentences, ready to paste into the team chat."""
    modes = report.turns_by_mode
    lines = [
        f"Last {report.days} days of the Telmi pilot",
        f"New accounts: {report.new_students} students, {report.new_teachers} teachers",
        f"Classes with sessions: {report.classes_with_activity}",
        f"Sessions: {report.sessions_started} started, {report.sessions_finished} finished, "
        f"{report.sessions_left_open} left open",
    ]
    if report.average_coverage_percent is None:
        lines.append("Average key ideas explained: no finished sessions yet")
    else:
        lines.append(f"Average key ideas explained: {report.average_coverage_percent}%")
    lines.append(
        f"Answers: {modes.get('talk', 0)} {MODE_NAMES['talk']}, "
        f"{modes.get('type', 0)} {MODE_NAMES['type']}, {modes.get('draw', 0)} {MODE_NAMES['draw']}"
    )
    if modes.get("not recorded", 0) > 0:
        lines.append(
            f"Answers from older app versions (mode not recorded): {modes['not recorded']}"
        )
    lines.append(f"Drawings read: {report.drawing_reads}")
    lines.append(f"Problem reports: {report.problem_reports} (read them in the Neon SQL editor)")
    for page, number in report.problem_pages.items():
        lines.append(f"Reports from {page or 'an unknown page'}: {number}")
    lines.append("AI errors and crashes: see Sentry and the Render logs")
    return "\n".join(lines)


def main() -> None:
    """Read DATABASE_URL, open the database read-only and print the report."""
    parser = argparse.ArgumentParser(description="Print the Telmi pilot's numbers.")
    parser.add_argument("--days", type=int, default=7, help="How many days back to count")
    arguments = parser.parse_args()

    engine = create_engine(normalise_database_url(os.environ["DATABASE_URL"]))
    with Session(engine) as db:
        # A report should never be able to change anything
        db.execute(text("SET TRANSACTION READ ONLY"))
        print(format_report(collect_report(db, arguments.days)))


if __name__ == "__main__":
    main()
