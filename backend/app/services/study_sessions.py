import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ai.buddy import SessionLanguage, generate_buddy_reply, opening_line
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
from app.models.common import as_utc
from app.schemas.study_sessions import TURN_MAX_CHARACTERS, DrawingRequest
from app.services.classrooms import get_unit_for_student
from app.services.errors import ConflictError, NotFoundError


def session_ends_at(study_session: StudySession, settings: Settings) -> datetime:
    """When the session's time cap runs out."""
    return as_utc(study_session.started_at) + timedelta(minutes=settings.session_minutes)


def is_out_of_time(study_session: StudySession, settings: Settings) -> bool:
    """True once the session's time cap has passed."""
    return datetime.now(UTC) > session_ends_at(study_session, settings)


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


def start_session(
    db: Session, student: User, unit_id: uuid.UUID, language: SessionLanguage
) -> StudySession:
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
            text=opening_line(unit, language),
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


def lock_session(db: Session, session_id: uuid.UUID) -> StudySession:
    """Re-read a session and hold its row until commit, so two requests can't both change it."""
    locked = db.get(StudySession, session_id, with_for_update=True, populate_existing=True)
    if locked is None:
        raise NotFoundError("Session not found")
    return locked


def release_connection(db: Session) -> None:
    """End the read transaction before a slow AI call, so the connection goes back to the pool."""
    db.commit()


def count_student_characters(turns: list[SessionTurn]) -> int:
    """How much the student has said so far, in characters."""
    total = 0
    for turn in turns:
        if turn.speaker == Speaker.STUDENT:
            total += len(turn.text)
    return total


def check_can_add_turn(
    settings: Settings, study_session: StudySession, turns: list[SessionTurn], text: str
) -> None:
    """Refuse a turn when the session is over, out of time, or full."""
    if study_session.status != SessionStatus.ACTIVE:
        raise ConflictError("This session is already finished")
    if is_out_of_time(study_session, settings):
        raise ConflictError("Time is up. Finish the session to see your feedback")
    if count_student_turns(turns) >= settings.max_student_turns:
        raise ConflictError("That's the last turn. Finish the session to see your feedback")
    if count_student_characters(turns) + len(text) > settings.max_student_characters:
        raise ConflictError(
            "That's all Pip can take in one go. Finish the session to see your feedback"
        )


def add_student_turn(
    db: Session,
    chat_model: ChatModel,
    settings: Settings,
    study_session: StudySession,
    text: str,
    input_mode: str | None = None,
) -> StudySession:
    """Save what the student said and the buddy's reply, or neither if the model fails."""
    turns = list_turns(db, study_session.id)
    check_can_add_turn(settings, study_session, turns, text)
    unit = get_unit(db, study_session)

    student_turn = SessionTurn(
        session_id=study_session.id,
        position=len(turns),
        speaker=Speaker.STUDENT,
        text=text,
        input_mode=input_mode,
    )
    conversation = turns + [student_turn]
    release_connection(db)
    buddy_text = generate_buddy_reply(chat_model, unit, conversation)

    # Check again: a double tap or a finish may have been saved while Pip was thinking
    locked = lock_session(db, study_session.id)
    if locked.status != SessionStatus.ACTIVE:
        db.rollback()
        raise ConflictError("This session is already finished")
    if len(list_turns(db, study_session.id)) != len(turns):
        db.rollback()
        raise ConflictError("Your last answer was already sent")

    db.add(student_turn)
    db.add(
        SessionTurn(
            session_id=study_session.id,
            position=len(conversation),
            speaker=Speaker.BUDDY,
            text=buddy_text,
        )
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ConflictError("Your last answer was already sent") from error
    return locked


def ensure_key_ideas(db: Session, chat_model: ChatModel, unit: Unit) -> list[str]:
    """Return the unit's fixed key ideas, extracting them the first time any session finishes."""
    if unit.key_ideas is not None:
        return unit.key_ideas

    # Extracted without holding a lock; if two first finishes race, only the first list is kept
    extracted = extract_key_ideas(chat_model, unit)
    locked_unit = db.get(Unit, unit.id, with_for_update=True, populate_existing=True)
    if locked_unit is None:
        raise NotFoundError("Unit not found")
    if locked_unit.key_ideas is None:
        locked_unit.key_ideas = extracted
    key_ideas = list(locked_unit.key_ideas or [])
    db.commit()
    return key_ideas


def finish_session(db: Session, chat_model: ChatModel, study_session: StudySession) -> StudySession:
    """Run the checker over the whole conversation and close the session."""
    # A retry after a dropped connection gets the saved results instead of an error
    if study_session.status == SessionStatus.COMPLETED:
        return study_session

    turns = list_turns(db, study_session.id)
    if count_student_turns(turns) == 0:
        raise ConflictError("Explain something first, then finish")

    unit = get_unit(db, study_session)
    release_connection(db)
    key_ideas = ensure_key_ideas(db, chat_model, unit)
    feedback = check_explanation(chat_model, unit, key_ideas, turns)

    # If another request finished it while the checker ran, keep that first result
    locked = lock_session(db, study_session.id)
    if locked.status == SessionStatus.ACTIVE:
        locked.feedback = feedback.model_dump(mode="json")
        locked.coverage_percent = calculate_coverage_percent(feedback)
        locked.status = SessionStatus.COMPLETED
        locked.completed_at = datetime.now(UTC)
    db.commit()
    return locked


def time_ran_out_unfinished(db: Session, settings: Settings, study_session: StudySession) -> bool:
    """True for a session left open past its time with something to grade, e.g. the app closed."""
    if study_session.status != SessionStatus.ACTIVE:
        return False
    if not is_out_of_time(study_session, settings):
        return False
    return count_student_turns(list_turns(db, study_session.id)) > 0


def answer_application_question(
    db: Session, chat_model: ChatModel, study_session: StudySession, answer: str
) -> StudySession:
    """Grade the student's one answer to the session's application question."""
    if study_session.status != SessionStatus.COMPLETED or study_session.feedback is None:
        raise ConflictError("Finish the session before answering the question")
    # Only the first answer is graded; a retry gets that grade back
    if study_session.application_answer is not None:
        return study_session

    feedback = CheckerFeedback.model_validate(study_session.feedback)
    unit = get_unit(db, study_session)
    release_connection(db)
    result = grade_application_answer(chat_model, unit, feedback.application_question, answer)

    locked = lock_session(db, study_session.id)
    if locked.application_answer is None:
        locked.application_answer = answer
        locked.application_result = result.model_dump(mode="json")
    db.commit()
    return locked


def read_session_drawing(
    db: Session,
    chat_model: ChatModel,
    settings: Settings,
    study_session: StudySession,
    drawing: DrawingRequest,
) -> str:
    """Copy out a drawing while the student can still send something; the drawing isn't saved."""
    answered = study_session.application_answer is not None
    if study_session.status == SessionStatus.COMPLETED and answered:
        raise ConflictError("This session has nothing left to answer")
    if study_session.status == SessionStatus.ACTIVE and is_out_of_time(study_session, settings):
        raise ConflictError("Time is up. Finish the session to see your feedback")

    # Counted before reading, so failed reads count too and can't be retried without end
    locked = lock_session(db, study_session.id)
    if locked.drawing_reads >= settings.max_drawing_reads:
        db.rollback()
        raise ConflictError("Pip has read all the drawings it can for this session. Type instead")
    locked.drawing_reads += 1
    db.commit()

    return read_drawing(chat_model, drawing)[:TURN_MAX_CHARACTERS]
