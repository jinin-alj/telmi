import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.buddy import generate_buddy_reply, opening_line
from app.ai.chat_model import ChatModel
from app.ai.checker import (
    CheckerFeedback,
    calculate_coverage_percent,
    check_explanation,
    extract_key_ideas,
    grade_application_answer,
)
from app.ai.drawing import read_drawing
from app.config import Settings
from app.models import SessionStatus, SessionTurn, Speaker, StudySession, Unit, User
from app.schemas.study_sessions import TURN_MAX_CHARACTERS, DrawingRequest
from app.services.classrooms import get_unit_for_student
from app.services.errors import ConflictError, NotFoundError


def as_utc(moment: datetime) -> datetime:
    """SQLite drops time zones, so treat naive timestamps as UTC."""
    if moment.tzinfo is None:
        return moment.replace(tzinfo=UTC)
    return moment


def session_ends_at(study_session: StudySession, settings: Settings) -> datetime:
    """When the session's time cap runs out."""
    return as_utc(study_session.started_at) + timedelta(minutes=settings.session_minutes)


def list_turns(db: Session, session_id: uuid.UUID) -> list[SessionTurn]:
    """The conversation in the order it happened."""
    query = select(SessionTurn).where(SessionTurn.session_id == session_id)
    return list(db.scalars(query.order_by(SessionTurn.position)))


def count_student_turns(turns: list[SessionTurn]) -> int:
    """How many times the student has spoken."""
    count = 0
    for turn in turns:
        if turn.speaker == Speaker.STUDENT:
            count += 1
    return count


def start_session(db: Session, student: User, unit_id: uuid.UUID) -> StudySession:
    """Open a session with the buddy's fixed greeting, so it starts with no model wait."""
    unit = get_unit_for_student(db, student, unit_id)
    study_session = StudySession(student_id=student.id, unit_id=unit.id)
    db.add(study_session)
    db.flush()
    db.add(
        SessionTurn(
            session_id=study_session.id,
            position=0,
            speaker=Speaker.BUDDY,
            text=opening_line(unit),
        )
    )
    db.commit()
    db.refresh(study_session)
    return study_session


def get_session_for_student(db: Session, student: User, session_id: uuid.UUID) -> StudySession:
    """Fetch one of the student's own sessions; anyone else's is 'not found'."""
    study_session = db.get(StudySession, session_id)
    if study_session is None or study_session.student_id != student.id:
        raise NotFoundError("Session not found")
    return study_session


def get_unit(db: Session, study_session: StudySession) -> Unit:
    """The unit a session is about."""
    unit = db.get(Unit, study_session.unit_id)
    if unit is None:
        raise NotFoundError("Unit not found")
    return unit


def add_student_turn(
    db: Session,
    chat_model: ChatModel,
    settings: Settings,
    study_session: StudySession,
    text: str,
) -> StudySession:
    """Save what the student said and the buddy's reply, or neither if the model fails."""
    if study_session.status != SessionStatus.ACTIVE:
        raise ConflictError("This session is already finished")
    if datetime.now(UTC) > session_ends_at(study_session, settings):
        raise ConflictError("Time is up. Finish the session to see your feedback")

    turns = list_turns(db, study_session.id)
    if count_student_turns(turns) >= settings.max_student_turns:
        raise ConflictError("That's the last turn. Finish the session to see your feedback")

    student_turn = SessionTurn(
        session_id=study_session.id,
        position=len(turns),
        speaker=Speaker.STUDENT,
        text=text,
    )
    turns.append(student_turn)

    unit = get_unit(db, study_session)
    buddy_text = generate_buddy_reply(chat_model, unit, turns)

    db.add(student_turn)
    db.add(
        SessionTurn(
            session_id=study_session.id,
            position=len(turns),
            speaker=Speaker.BUDDY,
            text=buddy_text,
        )
    )
    db.commit()
    return study_session


def ensure_key_ideas(db: Session, chat_model: ChatModel, unit: Unit) -> list[str]:
    """Return the unit's fixed key ideas, extracting them the first time any session finishes."""
    if unit.key_ideas is not None:
        return unit.key_ideas

    # Lock the row so two students finishing at once aren't graded on different lists
    locked_unit = db.get(Unit, unit.id, with_for_update=True, populate_existing=True)
    if locked_unit is None:
        raise NotFoundError("Unit not found")
    if locked_unit.key_ideas is None:
        locked_unit.key_ideas = extract_key_ideas(chat_model, locked_unit)
        db.commit()
    return list(locked_unit.key_ideas or [])


def finish_session(db: Session, chat_model: ChatModel, study_session: StudySession) -> StudySession:
    """Run the checker over the whole conversation and close the session."""
    if study_session.status != SessionStatus.ACTIVE:
        raise ConflictError("This session is already finished")

    turns = list_turns(db, study_session.id)
    if count_student_turns(turns) == 0:
        raise ConflictError("Explain something first, then finish")

    unit = get_unit(db, study_session)
    key_ideas = ensure_key_ideas(db, chat_model, unit)
    feedback = check_explanation(chat_model, unit, key_ideas, turns)

    study_session.feedback = feedback.model_dump(mode="json")
    study_session.coverage_percent = calculate_coverage_percent(feedback)
    study_session.status = SessionStatus.COMPLETED
    study_session.completed_at = datetime.now(UTC)
    db.commit()
    return study_session


def answer_application_question(
    db: Session, chat_model: ChatModel, study_session: StudySession, answer: str
) -> StudySession:
    """Grade the student's one answer to the session's application question."""
    if study_session.status != SessionStatus.COMPLETED or study_session.feedback is None:
        raise ConflictError("Finish the session before answering the question")
    if study_session.application_answer is not None:
        raise ConflictError("This question has already been answered")

    feedback = CheckerFeedback.model_validate(study_session.feedback)
    unit = get_unit(db, study_session)
    result = grade_application_answer(chat_model, unit, feedback.application_question, answer)

    study_session.application_answer = answer
    study_session.application_result = result.model_dump(mode="json")
    db.commit()
    return study_session


def read_session_drawing(
    chat_model: ChatModel, study_session: StudySession, drawing: DrawingRequest
) -> str:
    """Copy out a scratchpad drawing for the student to check; nothing is saved.

    Allowed while the student can still send something: during the session, or after it
    until they answer the exam-style question.
    """
    answered = study_session.application_answer is not None
    if study_session.status == SessionStatus.COMPLETED and answered:
        raise ConflictError("This session has nothing left to answer")
    return read_drawing(chat_model, drawing)[:TURN_MAX_CHARACTERS]
