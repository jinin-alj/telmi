import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Classroom, Enrollment, Unit, User, UserRole
from app.schemas.classrooms import ClassroomCreate, UnitCreate
from app.services.errors import ConflictError, NotFoundError

# No 0/O or 1/I/L so codes read aloud or copied from a board aren't mistyped
JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
JOIN_CODE_LENGTH = 6
MAX_CODE_ATTEMPTS = 5


def generate_join_code() -> str:
    """Random six-character code, about 887 million possibilities."""
    characters = []
    for _position in range(JOIN_CODE_LENGTH):
        characters.append(secrets.choice(JOIN_CODE_ALPHABET))
    return "".join(characters)


def create_classroom(db: Session, teacher: User, request: ClassroomCreate) -> Classroom:
    """Create a class with a unique join code."""
    for _attempt in range(MAX_CODE_ATTEMPTS):
        classroom = Classroom(
            teacher_id=teacher.id,
            name=request.name,
            subject=request.subject,
            join_code=generate_join_code(),
        )
        db.add(classroom)
        try:
            db.commit()
        except IntegrityError:
            # Another class already has this code, so roll back and draw again
            db.rollback()
            continue
        db.refresh(classroom)
        return classroom
    raise ConflictError("join_code_failed", "Could not generate a unique join code")


def join_classroom(db: Session, student: User, join_code: str) -> Classroom:
    """Add the student to the class with this code; joining twice is harmless."""
    classroom = db.scalar(select(Classroom).where(Classroom.join_code == join_code))
    if classroom is None:
        raise NotFoundError("unknown_join_code", "No class has that code")

    if not is_enrolled(db, student.id, classroom.id):
        db.add(Enrollment(classroom_id=classroom.id, student_id=student.id))
        try:
            db.commit()
        except IntegrityError:
            # A double tap raced us to it; the student is enrolled either way
            db.rollback()
    return classroom


def is_enrolled(db: Session, student_id: uuid.UUID, classroom_id: uuid.UUID) -> bool:
    """Whether the student has joined the class."""
    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.student_id == student_id, Enrollment.classroom_id == classroom_id
        )
    )
    return enrollment is not None


def list_classrooms(db: Session, user: User) -> list[Classroom]:
    """Teachers see the classes they own; students see the classes they joined."""
    if user.role == UserRole.TEACHER:
        query = select(Classroom).where(Classroom.teacher_id == user.id)
    else:
        query = (
            select(Classroom)
            .join(Enrollment, Enrollment.classroom_id == Classroom.id)
            .where(Enrollment.student_id == user.id)
        )
    return list(db.scalars(query.order_by(Classroom.created_at)))


def get_classroom_for_member(db: Session, user: User, classroom_id: uuid.UUID) -> Classroom:
    """Fetch a class the user owns or has joined; anyone else gets 'not found'."""
    classroom = db.get(Classroom, classroom_id)
    if classroom is None:
        raise NotFoundError("class_not_found", "Class not found")

    if user.role == UserRole.TEACHER and classroom.teacher_id == user.id:
        return classroom
    if user.role == UserRole.STUDENT and is_enrolled(db, user.id, classroom.id):
        return classroom
    raise NotFoundError("class_not_found", "Class not found")


def add_unit(db: Session, teacher: User, classroom_id: uuid.UUID, request: UnitCreate) -> Unit:
    """Add a unit to a class the teacher owns."""
    classroom = get_classroom_for_member(db, teacher, classroom_id)
    unit = Unit(classroom_id=classroom.id, title=request.title, material=request.material)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


def list_units(db: Session, user: User, classroom_id: uuid.UUID) -> list[Unit]:
    """Units in a class the user belongs to, oldest first."""
    classroom = get_classroom_for_member(db, user, classroom_id)
    query = select(Unit).where(Unit.classroom_id == classroom.id).order_by(Unit.created_at)
    return list(db.scalars(query))


def get_unit_for_student(db: Session, student: User, unit_id: uuid.UUID) -> Unit:
    """Fetch a unit from a class the student has joined."""
    unit = db.get(Unit, unit_id)
    if unit is None or not is_enrolled(db, student.id, unit.classroom_id):
        raise NotFoundError("unit_not_found", "Unit not found")
    return unit
