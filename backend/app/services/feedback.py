from datetime import UTC, datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import Feedback, User
from app.schemas.feedback import FeedbackCreate

# Reports are for fixing bugs during the pilot, so they aren't kept longer than six months
FEEDBACK_KEEP_DAYS = 180


def save_feedback(db: Session, user: User, report: FeedbackCreate) -> None:
    """Store a problem report and delete reports older than the keeping period."""
    oldest_kept = datetime.now(UTC) - timedelta(days=FEEDBACK_KEEP_DAYS)
    db.execute(
        delete(Feedback)
        .where(Feedback.created_at < oldest_kept)
        .execution_options(synchronize_session=False)
    )
    db.add(
        Feedback(
            user_id=user.id,
            role=user.role.value,
            page=report.page,
            app_version=report.app_version,
            message=report.message,
        )
    )
    db.commit()
