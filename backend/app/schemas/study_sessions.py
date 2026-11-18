import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.ai.buddy import SessionLanguage
from app.ai.checker import ApplicationResult, CheckerFeedback
from app.models import SessionStatus, Speaker
from app.schemas.text import TrimmedText

# Roughly two minutes of speech, plenty for one turn
TURN_MAX_CHARACTERS = 2000


class StartSessionRequest(BaseModel):
    """Which unit the student wants to explain, and the language they will speak."""

    unit_id: uuid.UUID
    # The language Pip greets in; older app versions don't send it
    language: SessionLanguage = "en"


class SessionLanguageRequest(BaseModel):
    """The language the student switched the app to."""

    language: SessionLanguage


InputMode = Literal["talk", "type", "draw"]


class StudentTurnRequest(BaseModel):
    """What the student just said, already turned into text on the device."""

    text: TrimmedText = Field(min_length=1, max_length=TURN_MAX_CHARACTERS)
    # How the answer was given; older app versions don't send it
    input_mode: InputMode | None = None


# Mirror mobile/src/features/session/drawing.ts; far more than a page of working needs
MAX_STROKES = 400
MAX_POINTS = 20000
MAX_CANVAS_SIZE = 10000.0
# Smaller than any real screen; tinier sizes would scale the pen to millions of pixels
MIN_CANVAS_SIZE = 50.0

PenColor = Literal["black", "blue", "red", "green"]
# Bounded, so infinities and NaN are refused too
Coordinate = Annotated[float, Field(ge=0, le=MAX_CANVAS_SIZE)]


class Stroke(BaseModel):
    """One line drawn without lifting the pen, as points in canvas coordinates."""

    color: PenColor
    points: list[tuple[Coordinate, Coordinate]] = Field(min_length=1, max_length=MAX_POINTS)


class DrawingRequest(BaseModel):
    """A scratchpad drawing: the canvas size and the strokes on it."""

    width: float = Field(ge=MIN_CANVAS_SIZE, le=MAX_CANVAS_SIZE)
    height: float = Field(ge=MIN_CANVAS_SIZE, le=MAX_CANVAS_SIZE)
    strokes: list[Stroke] = Field(min_length=1, max_length=MAX_STROKES)

    @model_validator(mode="after")
    def limit_total_points(self) -> "DrawingRequest":
        """Cap the whole drawing, not just each stroke, so one request stays small."""
        if sum(len(stroke.points) for stroke in self.strokes) > MAX_POINTS:
            raise ValueError(f"A drawing can have at most {MAX_POINTS} points")
        return self


class DrawingText(BaseModel):
    """What the vision model read from a drawing, for the student to check before sending."""

    text: str


class TurnPublic(BaseModel):
    """One line of the conversation."""

    model_config = ConfigDict(from_attributes=True)

    position: int
    speaker: Speaker
    text: str


class SessionDetail(BaseModel):
    """Everything the app needs to show a session, during or after it."""

    id: uuid.UUID
    unit_id: uuid.UUID
    unit_title: str
    status: SessionStatus
    started_at: datetime
    ends_at: datetime
    completed_at: datetime | None
    student_turns_left: int
    turns: list[TurnPublic]
    coverage_percent: int | None
    feedback: CheckerFeedback | None
    application_answer: str | None
    application_result: ApplicationResult | None
