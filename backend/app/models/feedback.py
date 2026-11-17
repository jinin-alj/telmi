import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.common import utc_now


class Feedback(Base):
    """A problem someone reported from the app, read by the team to find and fix bugs."""

    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Copied from the account, so reports can be grouped without looking anyone up
    role: Mapped[str] = mapped_column(String(20))
    # The page the person was on, e.g. /session/<id>
    page: Mapped[str] = mapped_column(String(200))
    app_version: Mapped[str] = mapped_column(String(40))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
