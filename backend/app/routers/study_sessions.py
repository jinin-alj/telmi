import logging
import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.ai.chat_model import ChatModelError
from app.ai.checker import ApplicationResult, CheckerFeedback
from app.config import Settings
from app.dependencies import (
    AppSettings,
    BuddyModel,
    CheckerModel,
    DbSession,
    StudentUser,
    VisionModel,
)
from app.models import StudySession, User
from app.schemas.study_sessions import (
    DrawingRequest,
    DrawingText,
    SessionDetail,
    StartSessionRequest,
    StudentTurnRequest,
    TurnPublic,
)
from app.services import study_sessions
from app.services.errors import ConflictError, NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["study sessions"])


def build_session_detail(
    db: Session, study_session: StudySession, settings: Settings
) -> SessionDetail:
    """Assemble the full view of a session for the app."""
    turns = study_sessions.list_turns(db, study_session.id)
    turns_used = study_sessions.count_student_turns(turns)

    public_turns = []
    for turn in turns:
        public_turns.append(TurnPublic.model_validate(turn))

    feedback = None
    if study_session.feedback is not None:
        feedback = CheckerFeedback.model_validate(study_session.feedback)

    application_result = None
    if study_session.application_result is not None:
        application_result = ApplicationResult.model_validate(study_session.application_result)

    return SessionDetail(
        id=study_session.id,
        unit_id=study_session.unit_id,
        unit_title=study_sessions.get_unit(db, study_session).title,
        status=study_session.status,
        started_at=study_sessions.as_utc(study_session.started_at),
        ends_at=study_sessions.session_ends_at(study_session, settings),
        completed_at=study_session.completed_at,
        student_turns_left=max(0, settings.max_student_turns - turns_used),
        turns=public_turns,
        coverage_percent=study_session.coverage_percent,
        feedback=feedback,
        application_answer=study_session.application_answer,
        application_result=application_result,
    )


def load_own_session(db: Session, student: User, session_id: uuid.UUID) -> StudySession:
    """Fetch the student's session or answer 404."""
    try:
        return study_sessions.get_session_for_student(db, student, session_id)
    except NotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


def buddy_unavailable(error: ChatModelError) -> HTTPException:
    """Log the model failure and give the app a retryable 503."""
    logger.error("Chat model failed: %s", error)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Your buddy can't answer right now. Please try again.",
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def start_session(
    request: StartSessionRequest, db: DbSession, settings: AppSettings, student: StudentUser
) -> SessionDetail:
    """Start explaining a unit to the buddy."""
    try:
        study_session = study_sessions.start_session(db, student, request.unit_id)
    except NotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return build_session_detail(db, study_session, settings)


@router.get("/{session_id}")
def read_session(
    session_id: uuid.UUID, db: DbSession, settings: AppSettings, student: StudentUser
) -> SessionDetail:
    """The conversation and, once finished, the feedback."""
    study_session = load_own_session(db, student, session_id)
    return build_session_detail(db, study_session, settings)


@router.post("/{session_id}/turns")
def add_turn(
    session_id: uuid.UUID,
    request: StudentTurnRequest,
    db: DbSession,
    settings: AppSettings,
    chat_model: BuddyModel,
    student: StudentUser,
) -> SessionDetail:
    """Send what the student said and get the buddy's reply."""
    study_session = load_own_session(db, student, session_id)
    try:
        study_sessions.add_student_turn(db, chat_model, settings, study_session, request.text)
    except ConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ChatModelError as error:
        db.rollback()
        raise buddy_unavailable(error) from error
    return build_session_detail(db, study_session, settings)


@router.post("/{session_id}/finish")
def finish_session(
    session_id: uuid.UUID,
    db: DbSession,
    settings: AppSettings,
    chat_model: CheckerModel,
    student: StudentUser,
) -> SessionDetail:
    """End the session and get the gap map, application question and next step."""
    study_session = load_own_session(db, student, session_id)
    try:
        study_sessions.finish_session(db, chat_model, study_session)
    except ConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ChatModelError as error:
        db.rollback()
        raise buddy_unavailable(error) from error
    return build_session_detail(db, study_session, settings)


@router.post("/{session_id}/application-answer")
def answer_application_question(
    session_id: uuid.UUID,
    request: StudentTurnRequest,
    db: DbSession,
    settings: AppSettings,
    chat_model: CheckerModel,
    student: StudentUser,
) -> SessionDetail:
    """Answer the exam-style question from the feedback and get it graded."""
    study_session = load_own_session(db, student, session_id)
    try:
        study_sessions.answer_application_question(db, chat_model, study_session, request.text)
    except ConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ChatModelError as error:
        db.rollback()
        raise buddy_unavailable(error) from error
    return build_session_detail(db, study_session, settings)


@router.post("/{session_id}/drawing-text")
def read_drawing(
    session_id: uuid.UUID,
    request: DrawingRequest,
    db: DbSession,
    chat_model: VisionModel,
    student: StudentUser,
) -> DrawingText:
    """Copy out what the student wrote on the scratchpad, for them to check before sending."""
    study_session = load_own_session(db, student, session_id)
    try:
        text = study_sessions.read_session_drawing(chat_model, study_session, request)
    except ConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ChatModelError as error:
        # Only the error is logged, never the drawing or what it said
        logger.error("Vision model failed: %s", error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pip can't read your drawing right now. Try again, or type instead.",
        ) from error

    if text == "":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="We couldn't find any writing. Try writing bigger, or type instead.",
        )
    return DrawingText(text=text)
