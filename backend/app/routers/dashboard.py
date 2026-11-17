import uuid

from fastapi import APIRouter, HTTPException, status

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/progress/me")
def read_my_progress(db: DbSession, student: StudentUser) -> StudentProgress:
    """The student's own progress and mascot."""
    return dashboard.build_student_progress(db, student)
