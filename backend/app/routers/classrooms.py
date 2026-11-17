import uuid

from fastapi import APIRouter, HTTPException, UploadFile, status

from app.dependencies import CurrentUser, DbSession, StudentUser, TeacherUser
from app.models import Classroom
from app.schemas.classrooms import (
    ClassroomCreate,
    ClassroomPublic,
    JoinClassroomRequest,
    MaterialText,
    UnitCreate,
    UnitPublic,
)
from app.services import classrooms, material_files
from app.services.errors import ConflictError, NotFoundError

router = APIRouter(prefix="/classrooms", tags=["classrooms"])


def to_public_list(classroom_list: list[Classroom]) -> list[ClassroomPublic]:
    """Convert database rows to response models."""
    public_list = []
    for classroom in classroom_list:
        public_list.append(ClassroomPublic.model_validate(classroom))
    return public_list


@router.post("", status_code=status.HTTP_201_CREATED)
def create_classroom(
    request: ClassroomCreate, db: DbSession, teacher: TeacherUser
) -> ClassroomPublic:
    """Create a class and get a join code to share with students."""
    try:
        classroom = classrooms.create_classroom(db, teacher, request)
    except ConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    return ClassroomPublic.model_validate(classroom)


@router.get("")
def list_classrooms(db: DbSession, current_user: CurrentUser) -> list[ClassroomPublic]:
    """Classes the teacher owns or the student has joined."""
    return to_public_list(classrooms.list_classrooms(db, current_user))


@router.post("/join")
def join_classroom(
    request: JoinClassroomRequest, db: DbSession, student: StudentUser
) -> ClassroomPublic:
    """Join a class with the code the teacher shared."""
    try:
        classroom = classrooms.join_classroom(db, student, request.join_code)
    except NotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return ClassroomPublic.model_validate(classroom)


@router.post("/{classroom_id}/units", status_code=status.HTTP_201_CREATED)
def add_unit(
    classroom_id: uuid.UUID, request: UnitCreate, db: DbSession, teacher: TeacherUser
) -> UnitPublic:
    """Add a topic with the material students will be checked against."""
    try:
        unit = classrooms.add_unit(db, teacher, classroom_id, request)
    except NotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return UnitPublic.model_validate(unit)


@router.post("/{classroom_id}/material-text")
def read_material_file(
    classroom_id: uuid.UUID, file: UploadFile, db: DbSession, teacher: TeacherUser
) -> MaterialText:
    """Read the text from a teacher's file; nothing is saved until they add the unit."""
    try:
        classrooms.get_classroom_for_member(db, teacher, classroom_id)
    except NotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    # One byte past the limit is enough to know it's too big, without holding all of it in memory
    content = file.file.read(material_files.MAX_FILE_BYTES + 1)
    try:
        return material_files.read_material_file(file.filename or "", content)
    except material_files.FileTooLargeError as error:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail=str(error)
        ) from error
    except material_files.UnsupportedFileError as error:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(error)
        ) from error
    except material_files.UnreadableFileError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)
        ) from error


@router.get("/{classroom_id}/units")
def list_units(
    classroom_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> list[UnitPublic]:
    """Units in a class, without their material."""
    try:
        unit_list = classrooms.list_units(db, current_user, classroom_id)
    except NotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    public_list = []
    for unit in unit_list:
        public_list.append(UnitPublic.model_validate(unit))
    return public_list
