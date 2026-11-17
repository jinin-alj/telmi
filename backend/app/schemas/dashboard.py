import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.classrooms import ClassroomPublic


class MisconceptionExample(BaseModel):
    """An anonymous example of a misconception, for the class view."""

    student_said: str
    correction: str


class IdeaSummary(BaseModel):
    """How the class is doing on one key idea, from each student's latest session."""

    idea_number: int
    idea: str
    students_covered: int
    students_missing: int
    misconception_count: int
    examples: list[MisconceptionExample]


class UnitSummary(BaseModel):
    """Class-wide picture of one unit."""

    unit_id: uuid.UUID
    title: str
    students_attempted: int
    # Sessions whose time ran out before the student finished, e.g. the app was closed
    unfinished_sessions: int
    average_coverage_percent: int | None
    # None until the first session on this unit finishes and the key ideas are extracted
    ideas: list[IdeaSummary] | None
    other_misconceptions: list[MisconceptionExample]


class StudentUnitResult(BaseModel):
    """One student's standing on one unit."""

    unit_id: uuid.UUID
    sessions_completed: int
    latest_coverage_percent: int | None
    last_completed_at: datetime | None
    missing_ideas: list[str]


class StudentSummary(BaseModel):
    """One student's standing across the class's units."""

    student_id: uuid.UUID
    display_name: str
    username: str
    average_coverage_percent: int | None
    units: list[StudentUnitResult]


class ClassroomDashboard(BaseModel):
    """Everything a teacher sees for one class. Students are listed by name, never ranked."""

    classroom: ClassroomPublic
    student_count: int
    units: list[UnitSummary]
    students: list[StudentSummary]


class Mascot(BaseModel):
    """The student's buddy. It grows only from ideas explained correctly, never from time spent."""

    level: int
    understood_ideas: int
    ideas_to_next_level: int


class UnitProgress(BaseModel):
    """A student's own progress on one unit."""

    unit_id: uuid.UUID
    title: str
    sessions_completed: int
    latest_coverage_percent: int | None
    best_coverage_percent: int | None
    ideas_understood: int
    total_ideas: int | None
    still_missing: list[str]
    next_step: str | None


class ClassroomProgress(BaseModel):
    """A student's progress in one class."""

    classroom: ClassroomPublic
    units: list[UnitProgress]


class StudentProgress(BaseModel):
    """Everything on the student's progress screen."""

    mascot: Mascot
    classrooms: list[ClassroomProgress]
