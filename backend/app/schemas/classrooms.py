import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.text import TrimmedText

# Keeps material plus a full conversation inside the model's context window (about 3,000 tokens)
MATERIAL_MAX_CHARACTERS = 12000


class ClassroomCreate(BaseModel):
    """A teacher's new class."""

    name: TrimmedText = Field(min_length=1, max_length=80)
    subject: TrimmedText = Field(min_length=1, max_length=60)


class ClassroomPublic(BaseModel):
    """A class as shown in the app."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    subject: str
    join_code: str


class JoinClassroomRequest(BaseModel):
    """The code a student types to join a class."""

    join_code: str = Field(min_length=6, max_length=8)

    @field_validator("join_code", mode="before")
    @classmethod
    def normalise_code(cls, value: object) -> object:
        """Codes are case-insensitive and may be typed with spaces."""
        if isinstance(value, str):
            return value.replace(" ", "").upper()
        return value


class UnitCreate(BaseModel):
    """A topic and the material the checker grades against."""

    title: TrimmedText = Field(min_length=1, max_length=120)
    # Too little material gives the checker nothing to grade against
    material: TrimmedText = Field(min_length=50, max_length=MATERIAL_MAX_CHARACTERS)


class MaterialText(BaseModel):
    """Text read from an uploaded file, for the teacher to check before saving a unit."""

    text: str
    # True when the file was very long and only its first part was read
    truncated: bool


class UnitPublic(BaseModel):
    """A unit without its material, so sessions stay closed-book."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    classroom_id: uuid.UUID
    title: str
    created_at: datetime
