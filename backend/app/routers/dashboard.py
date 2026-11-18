import uuid

from fastapi import APIRouter, status

from app.api_errors import api_error_for
from app.dependencies import AppSettings, DbSession, StudentUser, TeacherUser
from app.schemas.dashboard import ClassroomDashboard, StudentProgress
from app.services import dashboard
from app.services.errors import NotFoundError

router = APIRouter(tags=["dashboard"])


@router.get("/classrooms/{classroom_id}/dashboard")
def read_classroom_dashboard(
    classroom_id: uuid.UUID, db: DbSession, settings: AppSettings, teacher: TeacherUser
) -> ClassroomDashboard:
    """How each student and the whole class are doing on every unit."""
    try:
        return dashboard.build_classroom_dashboard(db, teacher, classroom_id, settings)
    except NotFoundError as error:
        raise api_error_for(status.HTTP_404_NOT_FOUND, error) from error


@router.get("/progress/me")
def read_my_progress(db: DbSession, student: StudentUser) -> StudentProgress:
    """The student's own progress and mascot."""
    return dashboard.build_student_progress(db, student)
