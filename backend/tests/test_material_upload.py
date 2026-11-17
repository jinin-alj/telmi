import io
import zipfile

import docx
import httpx
import pptx
import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from app.services import material_files
from tests.helpers import MATERIAL, create_class_with_unit, sign_up_as


def build_pdf(text: str) -> bytes:
    """A one-page PDF with real text, built by hand so tests need no PDF-making library."""
    stream = f"BT /F1 12 Tf 72 712 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_offset = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        pdf += f"{offset:010d} 00000 n \n".encode()
    pdf += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode()
    pdf += f"startxref\n{xref_offset}\n%%EOF\n".encode()
    return bytes(pdf)


def build_blank_pdf() -> bytes:
    """A PDF with a page but no text, like a scan."""
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def build_docx() -> bytes:
    """A Word file with a paragraph and a table."""
    document = docx.Document()
    document.add_paragraph("Plants make glucose in the chloroplasts.")
    table = document.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text = "Input"
    table.rows[0].cells[1].text = "Carbon dioxide"
    output = io.BytesIO()
    document.save(output)
    return output.getvalue()


def build_pptx() -> bytes:
    """Slides with a title and speaker notes."""
    presentation = pptx.Presentation()
    slide = presentation.slides.add_slide(presentation.slide_layouts[0])
    slide.shapes.title.text = "Photosynthesis"
    slide.notes_slide.notes_text_frame.text = "Oxygen is released as a by-product."
    output = io.BytesIO()
    presentation.save(output)
    return output.getvalue()


def upload(
    client: TestClient,
    headers: dict[str, str],
    classroom_id: str,
    file_name: str,
    content: bytes,
) -> httpx.Response:
    """Send one file to the material reader."""
    response: httpx.Response = client.post(
        f"/classrooms/{classroom_id}/material-text",
        files={"file": (file_name, content)},
        headers=headers,
    )
    return response


@pytest.fixture
def teacher_and_class(client: TestClient) -> tuple[dict[str, str], str]:
    """A signed-in teacher and the id of a class they own."""
    teacher = sign_up_as(client, "ms_lopez", "teacher")
    classroom_id, _join_code, _unit_id = create_class_with_unit(client, teacher)
    return teacher, classroom_id


def test_reads_text_from_a_pdf(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str]
) -> None:
    teacher, classroom_id = teacher_and_class

    response = upload(client, teacher, classroom_id, "notes.PDF", build_pdf("Light makes glucose"))

    assert response.status_code == 200
    assert response.json() == {"text": "Light makes glucose", "truncated": False}


def test_reads_paragraphs_and_tables_from_word(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str]
) -> None:
    teacher, classroom_id = teacher_and_class

    response = upload(client, teacher, classroom_id, "notes.docx", build_docx())

    assert response.status_code == 200
    assert response.json()["text"] == (
        "Plants make glucose in the chloroplasts.\n\nInput | Carbon dioxide"
    )


def test_reads_slides_and_speaker_notes(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str]
) -> None:
    teacher, classroom_id = teacher_and_class

    response = upload(client, teacher, classroom_id, "slides.pptx", build_pptx())

    assert response.status_code == 200
    assert response.json()["text"] == "Photosynthesis\n\nOxygen is released as a by-product."


def test_reads_plain_text_in_either_encoding(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str]
) -> None:
    teacher, classroom_id = teacher_and_class

    utf8 = upload(client, teacher, classroom_id, "a.txt", "Fotosíntesis\n\n\n\nsol".encode())
    windows = upload(client, teacher, classroom_id, "b.txt", "Fotosíntesis".encode("cp1252"))

    assert utf8.json()["text"] == "Fotosíntesis\n\nsol"
    assert windows.json()["text"] == "Fotosíntesis"


@pytest.mark.parametrize("file_name", ["notes.md", "notes.MARKDOWN"])
def test_reads_markdown_as_it_is_written(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str], file_name: str
) -> None:
    teacher, classroom_id = teacher_and_class
    markdown = "# Photosynthesis\n\n- Happens in **chloroplasts**\n- Releases oxygen\n"

    response = upload(client, teacher, classroom_id, file_name, markdown.encode())

    assert response.status_code == 200
    assert response.json()["text"] == markdown.strip()


def test_drops_characters_the_database_refuses(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str]
) -> None:
    teacher, classroom_id = teacher_and_class

    response = upload(client, teacher, classroom_id, "notes.txt", b"Chloro\x00plasts")

    assert response.json()["text"] == "Chloroplasts"


def test_cuts_very_long_files_and_says_so(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str]
) -> None:
    teacher, classroom_id = teacher_and_class
    long_text = "a" * (material_files.MAX_EXTRACTED_CHARACTERS + 100)

    response = upload(client, teacher, classroom_id, "long.txt", long_text.encode())

    assert response.status_code == 200
    assert response.json()["truncated"] is True
    assert len(response.json()["text"]) == material_files.MAX_EXTRACTED_CHARACTERS


def test_scanned_pdf_without_text_asks_for_pasting(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str]
) -> None:
    teacher, classroom_id = teacher_and_class

    response = upload(client, teacher, classroom_id, "scan.pdf", build_blank_pdf())

    assert response.status_code == 422
    assert response.json()["detail"] == material_files.NO_TEXT_MESSAGE


@pytest.mark.parametrize("file_name", ["broken.pdf", "broken.docx", "broken.pptx"])
def test_damaged_file_is_a_friendly_error(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str], file_name: str
) -> None:
    teacher, classroom_id = teacher_and_class

    response = upload(client, teacher, classroom_id, file_name, b"not really a document")

    assert response.status_code == 422
    assert response.json()["detail"] == material_files.DAMAGED_FILE_MESSAGE


def test_refuses_a_zip_that_unpacks_to_something_huge(
    client: TestClient,
    teacher_and_class: tuple[dict[str, str], str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    teacher, classroom_id = teacher_and_class
    # A real, readable Word file, so only the size check can refuse it
    word_file = build_docx()
    with zipfile.ZipFile(io.BytesIO(word_file)) as archive:
        unzipped_bytes = sum(member.file_size for member in archive.infolist())
    monkeypatch.setattr(material_files, "MAX_UNZIPPED_BYTES", unzipped_bytes - 1)

    response = upload(client, teacher, classroom_id, "bomb.docx", word_file)

    assert response.status_code == 422
    assert response.json()["detail"] == material_files.DAMAGED_FILE_MESSAGE


def test_refuses_unsupported_file_types(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str]
) -> None:
    teacher, classroom_id = teacher_and_class

    response = upload(client, teacher, classroom_id, "photo.png", b"\x89PNG")

    assert response.status_code == 415


def test_refuses_files_over_the_size_limit(
    client: TestClient,
    teacher_and_class: tuple[dict[str, str], str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    teacher, classroom_id = teacher_and_class
    monkeypatch.setattr(material_files, "MAX_FILE_BYTES", 100)

    response = upload(client, teacher, classroom_id, "notes.txt", MATERIAL.encode())

    assert response.status_code == 413


def test_other_teacher_cannot_use_the_class(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str]
) -> None:
    _owner, classroom_id = teacher_and_class
    other_teacher = sign_up_as(client, "mr_ruiz", "teacher")

    response = upload(client, other_teacher, classroom_id, "notes.txt", MATERIAL.encode())

    assert response.status_code == 404


def test_students_cannot_upload_material(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str]
) -> None:
    _teacher, classroom_id = teacher_and_class
    student = sign_up_as(client, "ana_g", "student")

    response = upload(client, student, classroom_id, "notes.txt", MATERIAL.encode())

    assert response.status_code == 403


def test_reading_a_file_saves_nothing(
    client: TestClient, teacher_and_class: tuple[dict[str, str], str]
) -> None:
    teacher, classroom_id = teacher_and_class

    upload(client, teacher, classroom_id, "notes.txt", MATERIAL.encode())

    units = client.get(f"/classrooms/{classroom_id}/units", headers=teacher).json()
    assert len(units) == 1
