import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.common import enum_values, utc_now

# JSONB on Postgres so the dashboard can query inside feedback; plain JSON elsewhere
FeedbackJson = JSON().with_variant(JSONB(), "postgresql")


class SessionStatus(StrEnum):
    """Where a study session is in its life."""

    ACTIVE = "active"
    COMPLETED = "completed"


class Speaker(StrEnum):
    """Who said a line in the session."""

    BUDDY = "buddy"
    STUDENT = "student"


class StudySession(Base):
    """One closed-book explanation of a unit by a student, and the checker's verdict."""

    __tablename__ = "study_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    unit_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("units.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status", values_callable=enum_values),
        default=SessionStatus.ACTIVE,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Share of the material's key ideas the student explained correctly, 0 to 100
    coverage_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feedback: Mapped[dict[str, Any] | None] = mapped_column(FeedbackJson, nullable=True)
    application_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    application_result: Mapped[dict[str, Any] | None] = mapped_column(FeedbackJson, nullable=True)
    # Scratchpad drawings read so far, to cap what one session can spend on the AI
    drawing_reads: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class SessionTurn(Base):
    """One line of the conversation, in order."""

    __tablename__ = "session_turns"
    # Two requests can never save a line in the same place, even if they race
    __table_args__ = (
        UniqueConstraint("session_id", "position", name="uq_session_turns_session_id_position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study_sessions.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    speaker: Mapped[Speaker] = mapped_column(
        Enum(Speaker, name="speaker", values_callable=enum_values)
    )
    text: Mapped[str] = mapped_column(Text)
    # "talk", "type" or "draw" for student turns, so the pilot shows how students answer
    input_mode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
