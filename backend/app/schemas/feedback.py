from pydantic import BaseModel, Field

from app.schemas.text import TrimmedText

# Enough to describe a problem; long enough pastes are almost always copied material
FEEDBACK_MAX_CHARACTERS = 1000


class FeedbackCreate(BaseModel):
    """A problem report from the app."""

    message: TrimmedText = Field(min_length=1, max_length=FEEDBACK_MAX_CHARACTERS)
    page: str = Field(default="", max_length=200)
    app_version: str = Field(default="", max_length=40)
