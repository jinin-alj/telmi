import pytest

from app.ai.buddy import (
    BUDDY_INSTRUCTIONS,
    generate_buddy_reply,
    opening_line,
    remove_agreement,
    remove_echo,
    split_sentences,
)
from app.models import SessionTurn, Speaker, Unit
from tests.fakes import FakeChatModel


@pytest.mark.parametrize(
    "reply, expected",
    [
        (
            "Yeah, that's the main idea. How does light change the amount of glucose?",
            "How does light change the amount of glucose?",
        ),
        ("Exactly! But why do leaves look green?", "But why do leaves look green?"),
        ("Got it. Where does the oxygen go?", "Where does the oxygen go?"),
        ("Sí, eso es. ¿Y por qué las hojas son verdes?", "¿Y por qué las hojas son verdes?"),
        ("¡Exacto! ¿Y de dónde sale el oxígeno?", "¿Y de dónde sale el oxígeno?"),
    ],
)
def test_drops_an_opening_sentence_that_agrees(reply: str, expected: str) -> None:
    assert remove_agreement(reply) == expected


@pytest.mark.parametrize(
    "reply",
    [
        "Hmm, wait. Why do plants need light?",
        "Right? I thought plants ate soil.",
        "Yesterday you said leaves are green. Why is that?",
        "Si las plantas no tienen luz, ¿qué pasa?",
        "Yes.",
    ],
)
def test_keeps_replies_that_do_not_open_by_agreeing(reply: str) -> None:
    # Questions, look-alike words, Spanish "si" meaning "if", and a reply with nothing else
    assert remove_agreement(reply) == reply


def test_buddy_reply_goes_through_the_agreement_filter() -> None:
    fake_model = FakeChatModel()
    fake_model.queue_reply("Correct. So what happens to the oxygen?")
    unit = Unit(title="Photosynthesis", material="Plants make glucose using light.")

    reply = generate_buddy_reply(fake_model, unit, [])

    assert reply == "So what happens to the oxygen?"


def test_instructions_forbid_agreeing_and_repeating() -> None:
    assert "Never agree, confirm or praise" in BUDDY_INSTRUCTIONS
    assert "never repeat a guess you already made" in BUDDY_INSTRUCTIONS
    assert "Never repeat the student's own words or claims" in BUDDY_INSTRUCTIONS
    assert 'do not start with "So"' in BUDDY_INSTRUCTIONS


def test_splits_a_reply_into_sentences() -> None:
    # An ellipsis or "?!" stays with its sentence instead of making empty ones
    assert split_sentences("Hmm... So what? Why?! Ok") == ["Hmm...", "So what?", "Why?!", "Ok"]


@pytest.mark.parametrize(
    "student, reply, expected",
    [
        (
            "The glucose is produced inside the chloroplasts of the leaf.",
            "Hmm, so the glucose is produced inside the chloroplasts… But how does it leave?",
            "But how does it leave?",
        ),
        (
            "Plants get their food from the soil through the roots.",
            "Oh. So plants get their food from the soil through the roots. Why do they need light?",
            "Oh. Why do they need light?",
        ),
        (
            "La glucosa se produce dentro de los cloroplastos de la hoja.",
            "Mmm, entonces la glucosa se produce dentro de los cloroplastos. ¿Y cómo sale?",
            "¿Y cómo sale?",
        ),
    ],
)
def test_drops_sentences_that_repeat_the_student(student: str, reply: str, expected: str) -> None:
    assert remove_echo(reply, student) == expected


@pytest.mark.parametrize(
    "reply",
    [
        # A question about the student's idea is what Pip should do, even in their words
        "Wait, if the plant gets food from the soil, what role does the glucose play?",
        # Short reactions share a word by chance
        "Oh, the soil. Why?",
        # Pip's own guess uses different words
        "I always thought leaves just store water. Is that wrong?",
        # Never leave Pip with nothing to say
        "So plants get their food from the soil.",
    ],
)
def test_keeps_sentences_that_do_not_repeat_the_student(reply: str) -> None:
    student = "Plants get their food from the soil, I think."
    assert remove_echo(reply, student) == reply


def test_buddy_reply_drops_an_echo_of_the_last_thing_the_student_said() -> None:
    fake_model = FakeChatModel()
    fake_model.queue_reply("Hmm, so oxygen leaves through the stomata. Where do those sit?")
    unit = Unit(title="Photosynthesis", material="Plants make glucose using light.")
    turns = [
        SessionTurn(position=0, speaker=Speaker.BUDDY, text="Hi! Can you explain it?"),
        SessionTurn(position=1, speaker=Speaker.STUDENT, text="Oxygen leaves through the stomata."),
    ]

    reply = generate_buddy_reply(fake_model, unit, turns)

    assert reply == "Where do those sit?"


def test_opening_line_speaks_the_session_language() -> None:
    unit = Unit(title="Photosynthesis", material="Plants make glucose using light.")

    assert opening_line(unit, "en").startswith("Hi! I missed the class on Photosynthesis.")
    assert opening_line(unit, "es").startswith("¡Hola! Me perdí la clase de Photosynthesis.")
