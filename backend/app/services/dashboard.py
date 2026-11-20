import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.checker import CheckerFeedback, IdeaStatus
from app.config import Settings
from app.models import Enrollment, SessionStatus, StudySession, Unit, User
from app.schemas.classrooms import ClassroomPublic
from app.schemas.dashboard import (
    ClassroomDashboard,
    ClassroomProgress,
    IdeaSummary,
    Mascot,
    MisconceptionExample,
    StudentProgress,
    StudentSummary,
    StudentUnitResult,
    UnitProgress,
    UnitSummary,
)
from app.services.classrooms import get_classroom_for_member, list_classrooms

# Enough to show a pattern without turning the dashboard into a transcript dump
MAX_EXAMPLES = 3

# Small steps so a student sees the buddy grow after a session or two
IDEAS_PER_LEVEL = 5

SessionKey = tuple[uuid.UUID, uuid.UUID]


def load_completed_sessions(
    db: Session, unit_ids: list[uuid.UUID], student_id: uuid.UUID | None = None
) -> list[StudySession]:
    """Finished sessions for these units, optionally for one student, oldest first."""
    if len(unit_ids) == 0:
        return []
    query = select(StudySession).where(
        StudySession.unit_id.in_(unit_ids), StudySession.status == SessionStatus.COMPLETED
    )
    if student_id is not None:
        query = query.where(StudySession.student_id == student_id)
    return list(db.scalars(query.order_by(StudySession.completed_at)))


def count_unfinished_sessions(
    db: Session, unit_ids: list[uuid.UUID], student_ids: set[uuid.UUID], settings: Settings
) -> dict[uuid.UUID, int]:
    """Per unit, sessions by these students that ran out of time without being finished."""
    counts: dict[uuid.UUID, int] = {}
    if len(unit_ids) == 0:
        return counts
    time_ran_out_before = datetime.now(UTC) - timedelta(minutes=settings.session_minutes)
    query = select(StudySession).where(
        StudySession.unit_id.in_(unit_ids),
        StudySession.status == SessionStatus.ACTIVE,
        StudySession.started_at < time_ran_out_before,
    )
    for study_session in db.scalars(query):
        if study_session.student_id in student_ids:
            counts[study_session.unit_id] = counts.get(study_session.unit_id, 0) + 1
    return counts


def group_by_student_and_unit(sessions: list[StudySession]) -> dict[SessionKey, list[StudySession]]:
    """Bucket sessions by (student, unit), keeping them oldest first."""
    grouped: dict[SessionKey, list[StudySession]] = {}
    for study_session in sessions:
        key = (study_session.student_id, study_session.unit_id)
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(study_session)
    return grouped


def aligned_feedback(study_session: StudySession, unit: Unit) -> CheckerFeedback | None:
    """The session's feedback, if it was graded on the unit's current key ideas."""
    if study_session.feedback is None or unit.key_ideas is None:
        return None
    feedback = CheckerFeedback.model_validate(study_session.feedback)
    if len(feedback.key_ideas) != len(unit.key_ideas):
        return None
    return feedback


def average_percent(values: list[int]) -> int | None:
    """Rounded mean, or None when there's nothing to average."""
    if len(values) == 0:
        return None
    return round(sum(values) / len(values))


def missing_ideas(
    feedback: CheckerFeedback | None, idea_texts: list[str] | None = None
) -> list[str]:
    """Ideas the student didn't explain, in idea_texts' words if given, else as they saw them."""
    if feedback is None:
        return []
    missing = []
    for position, key_idea in enumerate(feedback.key_ideas):
        if key_idea.status == IdeaStatus.MISSING:
            if idea_texts is None:
                missing.append(key_idea.idea)
            else:
                missing.append(idea_texts[position])
    return missing


def empty_idea_summaries(key_ideas: list[str]) -> list[IdeaSummary]:
    """One zeroed tally per key idea, numbered from 1."""
    ideas = []
    for position, idea in enumerate(key_ideas, start=1):
        ideas.append(
            IdeaSummary(
                idea_number=position,
                idea=idea,
                students_covered=0,
                students_missing=0,
                misconception_count=0,
                examples=[],
            )
        )
    return ideas


def tally_feedback(
    ideas: list[IdeaSummary],
    other_misconceptions: list[MisconceptionExample],
    feedback: CheckerFeedback,
) -> None:
    """Add one student's latest feedback to the class tallies."""
    for idea_summary, key_idea in zip(ideas, feedback.key_ideas, strict=True):
        if key_idea.status == IdeaStatus.COVERED:
            idea_summary.students_covered += 1
        else:
            idea_summary.students_missing += 1

    for misconception in feedback.misconceptions:
        example = MisconceptionExample(
            student_said=misconception.student_said, correction=misconception.correction
        )
        if misconception.idea_number is None:
            if len(other_misconceptions) < MAX_EXAMPLES:
                other_misconceptions.append(example)
            continue
        idea_summary = ideas[misconception.idea_number - 1]
        idea_summary.misconception_count += 1
        if len(idea_summary.examples) < MAX_EXAMPLES:
            idea_summary.examples.append(example)


def build_unit_summary(
    unit: Unit, latest_sessions: list[StudySession], unfinished_sessions: int
) -> UnitSummary:
    """Class-wide view of one unit, from each student's latest session."""
    coverages = []
    for study_session in latest_sessions:
        if study_session.coverage_percent is not None:
            coverages.append(study_session.coverage_percent)

    ideas = None
    other_misconceptions: list[MisconceptionExample] = []
    if unit.key_ideas is not None:
        ideas = empty_idea_summaries(unit.key_ideas)
        for study_session in latest_sessions:
            feedback = aligned_feedback(study_session, unit)
            if feedback is not None:
                tally_feedback(ideas, other_misconceptions, feedback)

    return UnitSummary(
        unit_id=unit.id,
        title=unit.title,
        students_attempted=len(latest_sessions),
        unfinished_sessions=unfinished_sessions,
        average_coverage_percent=average_percent(coverages),
        ideas=ideas,
        other_misconceptions=other_misconceptions,
    )


def build_student_summary(
    student: User, units: list[Unit], grouped: dict[SessionKey, list[StudySession]]
) -> StudentSummary:
    """One student's latest standing on every unit in the class."""
    unit_results = []
    coverages = []
    for unit in units:
        sessions = grouped.get((student.id, unit.id), [])
        if len(sessions) == 0:
            unit_results.append(
                StudentUnitResult(
                    unit_id=unit.id,
                    sessions_completed=0,
                    latest_coverage_percent=None,
                    last_completed_at=None,
                    missing_ideas=[],
                )
            )
            continue

        latest = sessions[-1]
        if latest.coverage_percent is not None:
            coverages.append(latest.coverage_percent)
        unit_results.append(
            StudentUnitResult(
                unit_id=unit.id,
                sessions_completed=len(sessions),
                latest_coverage_percent=latest.coverage_percent,
                last_completed_at=latest.completed_at,
                # The teacher reads the material's own words, whatever language the student used
                missing_ideas=missing_ideas(aligned_feedback(latest, unit), unit.key_ideas),
            )
        )

    return StudentSummary(
        student_id=student.id,
        display_name=student.display_name,
        username=student.username,
        average_coverage_percent=average_percent(coverages),
        units=unit_results,
    )


def build_classroom_dashboard(
    db: Session, teacher: User, classroom_id: uuid.UUID, settings: Settings
) -> ClassroomDashboard:
    """The teacher's view of a class they own."""
    classroom = get_classroom_for_member(db, teacher, classroom_id)
    units = list(
        db.scalars(select(Unit).where(Unit.classroom_id == classroom.id).order_by(Unit.created_at))
    )
    students = list(
        db.scalars(
            select(User)
            .join(Enrollment, Enrollment.student_id == User.id)
            .where(Enrollment.classroom_id == classroom.id)
            .order_by(User.display_name, User.username)
        )
    )

    unit_ids = []
    for unit in units:
        unit_ids.append(unit.id)
    student_ids = set()
    for student in students:
        student_ids.add(student.id)

    # Sessions from students who have since left the class are not shown
    enrolled_sessions = []
    for study_session in load_completed_sessions(db, unit_ids):
        if study_session.student_id in student_ids:
            enrolled_sessions.append(study_session)
    grouped = group_by_student_and_unit(enrolled_sessions)
    unfinished = count_unfinished_sessions(db, unit_ids, student_ids, settings)

    unit_summaries = []
    for unit in units:
        latest_sessions = []
        for student in students:
            sessions = grouped.get((student.id, unit.id), [])
            if len(sessions) > 0:
                latest_sessions.append(sessions[-1])
        unit_summaries.append(build_unit_summary(unit, latest_sessions, unfinished.get(unit.id, 0)))

    student_summaries = []
    for student in students:
        student_summaries.append(build_student_summary(student, units, grouped))

    return ClassroomDashboard(
        classroom=ClassroomPublic.model_validate(classroom),
        student_count=len(students),
        units=unit_summaries,
        students=student_summaries,
    )


def count_understood_ideas(unit: Unit, sessions: list[StudySession]) -> int:
    """Distinct key ideas the student has explained correctly in any session on this unit."""
    understood_positions = set()
    for study_session in sessions:
        feedback = aligned_feedback(study_session, unit)
        if feedback is None:
            continue
        for position, key_idea in enumerate(feedback.key_ideas):
            if key_idea.status == IdeaStatus.COVERED:
                understood_positions.add(position)
    return len(understood_positions)


def calculate_mascot(understood_ideas: int) -> Mascot:
    """Level the buddy up every few ideas the student has shown they understand."""
    return Mascot(
        level=1 + understood_ideas // IDEAS_PER_LEVEL,
        understood_ideas=understood_ideas,
        ideas_to_next_level=IDEAS_PER_LEVEL - understood_ideas % IDEAS_PER_LEVEL,
    )


def build_unit_progress(unit: Unit, sessions: list[StudySession]) -> UnitProgress:
    """The student's own history on one unit."""
    if len(sessions) == 0:
        return UnitProgress(
            unit_id=unit.id,
            title=unit.title,
            sessions_completed=0,
            latest_coverage_percent=None,
            best_coverage_percent=None,
            ideas_understood=0,
            total_ideas=None if unit.key_ideas is None else len(unit.key_ideas),
            still_missing=[],
            next_step=None,
        )

    coverages = []
    for study_session in sessions:
        if study_session.coverage_percent is not None:
            coverages.append(study_session.coverage_percent)

    latest = sessions[-1]
    latest_feedback = aligned_feedback(latest, unit)
    next_step = None
    if latest.feedback is not None:
        next_step = CheckerFeedback.model_validate(latest.feedback).next_step

    return UnitProgress(
        unit_id=unit.id,
        title=unit.title,
        sessions_completed=len(sessions),
        latest_coverage_percent=latest.coverage_percent,
        best_coverage_percent=max(coverages) if len(coverages) > 0 else None,
        ideas_understood=count_understood_ideas(unit, sessions),
        total_ideas=None if unit.key_ideas is None else len(unit.key_ideas),
        still_missing=missing_ideas(latest_feedback),
        next_step=next_step,
    )


def build_student_progress(db: Session, student: User) -> StudentProgress:
    """The student's progress in every class they've joined, plus their mascot."""
    classroom_progress_list = []
    understood_ideas = 0

    for classroom in list_classrooms(db, student):
        units = list(
            db.scalars(
                select(Unit).where(Unit.classroom_id == classroom.id).order_by(Unit.created_at)
            )
        )
        unit_ids = []
        for unit in units:
            unit_ids.append(unit.id)

        grouped = group_by_student_and_unit(load_completed_sessions(db, unit_ids, student.id))

        unit_progress_list = []
        for unit in units:
            unit_progress = build_unit_progress(unit, grouped.get((student.id, unit.id), []))
            understood_ideas += unit_progress.ideas_understood
            unit_progress_list.append(unit_progress)

        classroom_progress_list.append(
            ClassroomProgress(
                classroom=ClassroomPublic.model_validate(classroom), units=unit_progress_list
            )
        )

    return StudentProgress(
        mascot=calculate_mascot(understood_ideas), classrooms=classroom_progress_list
    )
