from fastapi import APIRouter, Request, Response, status

from app.dependencies import CurrentUser, DbSession
from app.schemas.feedback import FeedbackCreate
from app.security.rate_limit import check_rate_limit
from app.services.feedback import save_feedback

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
def report_problem(
    report: FeedbackCreate, request: Request, db: DbSession, current_user: CurrentUser
) -> Response:
    """Save a problem report from a signed-in student or teacher."""
    check_rate_limit(request.app.state.feedback_limiter, str(current_user.id))
    save_feedback(db, current_user, report)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
