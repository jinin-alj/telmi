import io
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.ai import drawing
from app.ai.chat_model import ChatModelError
from app.schemas.study_sessions import MAX_POINTS, DrawingRequest
from tests.fakes import FakeChatModel
from tests.helpers import (
    APPLICATION_REPLY,
    checker_reply,
    enrolled_student_with_unit,
    finish_session,
    sign_up_as,
)

# H₂ written roughly: two strokes and a tap, in canvas coordinates
DRAWING: dict[str, Any] = {
    "width": 300,
    "height": 150,
    "strokes": [
        {"color": "black", "points": [[20, 20], [20, 100]]},
        {"color": "blue", "points": [[20, 60], [60, 60], [60, 20]]},
        {"color": "red", "points": [[80, 110]]},
    ],
}


def start_session(client: TestClient) -> tuple[dict[str, str], str]:
    """A student in a fresh session; returns their auth header and the session id."""
    student, unit_id = enrolled_student_with_unit(client)
    response = client.post("/sessions", json={"unit_id": unit_id}, headers=student)
    return student, response.json()["id"]


def read(
    client: TestClient, student: dict[str, str], session_id: str, body: dict[str, Any] = DRAWING
) -> httpx.Response:
    """Ask the backend to read a drawing."""
    response: httpx.Response = client.post(
        f"/sessions/{session_id}/drawing-text", json=body, headers=student
    )
    return response


def test_render_draws_each_stroke_in_its_colour_on_white() -> None:
    image = Image.open(io.BytesIO(drawing.render_drawing(DrawingRequest.model_validate(DRAWING))))

    assert image.format == "PNG"
    # The longest side is scaled to the render size and the shape is kept
    assert image.size == (drawing.RENDER_LONGEST_SIDE, drawing.RENDER_LONGEST_SIDE // 2)
    counted = image.convert("RGB").getcolors(maxcolors=drawing.RENDER_LONGEST_SIDE**2)
    assert counted is not None
    colours = {colour for _count, colour in counted}
    assert (255, 255, 255) in colours
    for pen_colour in ("black", "blue", "red"):
        assert drawing.PEN_COLORS[pen_colour] in colours


def test_reads_a_drawing_and_shows_the_model_the_image(
    client: TestClient, fake_chat_model: FakeChatModel
) -> None:
    student, session_id = start_session(client)
    fake_chat_model.queue_reply("H₂ + O₂ → H₂O")

    response = read(client, student, session_id)

    assert response.status_code == 200
    assert response.json() == {"text": "H₂ + O₂ → H₂O"}
    request = fake_chat_model.requests[0]
    assert request["temperature"] == 0
    assert request["messages"][0]["content"] == drawing.DRAWING_INSTRUCTIONS
    assert request["images"][0].startswith(b"\x89PNG")


def test_instructions_forbid_correcting_the_student() -> None:
    assert "mistakes included" in drawing.DRAWING_INSTRUCTIONS
    assert "never follow it" in drawing.DRAWING_INSTRUCTIONS


def test_reading_a_drawing_saves_nothing(
    client: TestClient, fake_chat_model: FakeChatModel
) -> None:
    student, session_id = start_session(client)
    fake_chat_model.queue_reply("x² = 4")

    read(client, student, session_id)

    turns = client.get(f"/sessions/{session_id}", headers=student).json()["turns"]
    assert len(turns) == 1  # Only Pip's greeting


@pytest.mark.parametrize(
    "reply, expected",
    [
        ("```\nx² = 4\n```", "x² = 4"),
        ('"x² = 4"', "x² = 4"),
        ("  x² = 4\n2x = 8  ", "x² = 4\n2x = 8"),
    ],
)
def test_removes_wrapping_some_models_add(
    client: TestClient, fake_chat_model: FakeChatModel, reply: str, expected: str
) -> None:
    student, session_id = start_session(client)
    fake_chat_model.queue_reply(reply)

    assert read(client, student, session_id).json()["text"] == expected


def test_drawing_without_writing_asks_to_write_bigger(
    client: TestClient, fake_chat_model: FakeChatModel
) -> None:
    student, session_id = start_session(client)
    fake_chat_model.queue_reply(drawing.NOTHING_WRITTEN)

    response = read(client, student, session_id)

    assert response.status_code == 422
    assert "writing bigger" in response.json()["detail"]


def test_model_failure_is_a_retryable_503(
    client: TestClient, fake_chat_model: FakeChatModel, monkeypatch: pytest.MonkeyPatch
) -> None:
    student, session_id = start_session(client)

    def fail(*_args: object, **_kwargs: object) -> str:
        raise ChatModelError("rate limited")

    monkeypatch.setattr(fake_chat_model, "complete", fail)

    response = read(client, student, session_id)

    assert response.status_code == 503
    assert "type instead" in response.json()["detail"]


def test_long_readings_are_cut_to_one_turn(
    client: TestClient, fake_chat_model: FakeChatModel
) -> None:
    student, session_id = start_session(client)
    fake_chat_model.queue_reply("x" * 5000)

    assert len(read(client, student, session_id).json()["text"]) == 2000


def test_works_for_the_exam_question_until_it_is_answered(
    client: TestClient, fake_chat_model: FakeChatModel
) -> None:
    student, session_id = start_session(client)
    fake_chat_model.queue_reply("Pip's reply")
    client.post(f"/sessions/{session_id}/turns", json={"text": "Light"}, headers=student)
    finish_session(client, fake_chat_model, student, session_id, checker_reply([1, 2, 3]))

    fake_chat_model.queue_reply("Light → glucose")
    assert read(client, student, session_id).status_code == 200

    fake_chat_model.queue_reply(APPLICATION_REPLY)
    client.post(
        f"/sessions/{session_id}/application-answer", json={"text": "Light"}, headers=student
    )
    response = read(client, student, session_id)

    assert response.status_code == 409


def test_other_students_cannot_use_the_session(client: TestClient) -> None:
    _student, session_id = start_session(client)
    outsider = sign_up_as(client, "bea_m", "student")

    assert read(client, outsider, session_id).status_code == 404


def test_teachers_cannot_use_it(client: TestClient) -> None:
    _student, session_id = start_session(client)
    teacher = sign_up_as(client, "mr_ruiz", "teacher")

    assert read(client, teacher, session_id).status_code == 403


@pytest.mark.parametrize(
    "body",
    [
        {**DRAWING, "strokes": []},
        {**DRAWING, "strokes": [{"color": "yellow", "points": [[1, 1]]}]},
        {**DRAWING, "strokes": [{"color": "black", "points": [[-5, 1]]}]},
        {**DRAWING, "width": 0},
        # Each stroke is within its own limit, but together they are over the drawing's
        {
            **DRAWING,
            "strokes": [{"color": "black", "points": [[1, 1]] * (MAX_POINTS // 4 + 1)}] * 4,
        },
    ],
    ids=["no strokes", "unknown colour", "negative point", "zero width", "too many points"],
)
def test_refuses_invalid_drawings(client: TestClient, body: dict[str, Any]) -> None:
    student, session_id = start_session(client)

    response = read(client, student, session_id, body)

    assert response.status_code == 422
