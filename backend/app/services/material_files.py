"""Turn a teacher's uploaded file into plain text for the unit material box.

Nothing is stored: the text goes back to the app, the teacher checks and edits it,
and the existing "add unit" request saves it exactly like pasted material.
"""

import io
import re
import threading
import zipfile
from collections.abc import Callable, Iterable, Iterator
from pathlib import PurePath
from typing import Any

import docx
import pptx
from pptx.shapes.autoshape import Shape
from pptx.shapes.base import BaseShape
from pptx.shapes.graphfrm import GraphicFrame
from pptx.shapes.group import GroupShape
from pypdf import PdfReader

from app.schemas.classrooms import MaterialText
from app.services.errors import AppError

# Slides full of pictures can be large even when their text is short
MAX_FILE_BYTES = 20 * 1024 * 1024

# Word and PowerPoint files are zips; bigger unpacked sizes could use up the 512 MB server
MAX_UNZIPPED_BYTES = 50 * 1024 * 1024

# Password-protected Office files, and old .doc and .ppt files, start with these bytes
OLD_OFFICE_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

# One file is read at a time, so several teachers uploading together can't use up the memory
reading_slot = threading.BoundedSemaphore(1)

# Well above a unit's limit, so the teacher can choose what to keep from a long file,
# but small enough that one upload can't flood the app
MAX_EXTRACTED_CHARACTERS = 60000

PIECE_SEPARATOR = "\n\n"

DAMAGED_FILE_MESSAGE = "We couldn't open this file. Try saving it again, or paste the text instead."
LOCKED_FILE_MESSAGE = (
    "This file is password-protected or in an old format. Remove the password or save it as "
    ".docx or .pptx, then try again."
)
NO_TEXT_MESSAGE = (
    "We couldn't find any text in this file. If it's a scan or a photo, paste the text instead."
)


class UnsupportedFileError(AppError):
    """The file type isn't one we can read."""


class FileTooLargeError(AppError):
    """The upload is bigger than we accept."""


class UnreadableFileError(AppError):
    """The file is damaged, locked, or has no text we can find."""


def read_material_file(file_name: str, content: bytes) -> MaterialText:
    """Read the text from a PDF, Word, PowerPoint, plain text or Markdown file."""
    if len(content) > MAX_FILE_BYTES:
        raise FileTooLargeError(
            "file_too_large", f"Files can be at most {MAX_FILE_BYTES // (1024 * 1024)} MB."
        )

    reader = READERS.get(PurePath(file_name).suffix.lower())
    if reader is None:
        raise UnsupportedFileError(
            "file_unsupported",
            "Upload a PDF, Word (.docx), PowerPoint (.pptx), text (.txt) or Markdown (.md) file.",
        )

    if content.startswith(OLD_OFFICE_SIGNATURE):
        raise UnreadableFileError("file_locked", LOCKED_FILE_MESSAGE)

    try:
        with reading_slot:
            material = join_pieces(reader(content))
    except UnreadableFileError:
        raise
    # Each parser fails differently on a damaged file, and all of them mean the same to a teacher
    except Exception as error:
        raise UnreadableFileError("file_damaged", DAMAGED_FILE_MESSAGE) from error

    if material.text == "":
        raise UnreadableFileError("file_no_text", NO_TEXT_MESSAGE)
    return material


def read_pdf(content: bytes) -> Iterator[str]:
    """Yield the text of each page; scanned pages have none."""
    reader = PdfReader(io.BytesIO(content))
    if reader.is_encrypted:
        raise UnreadableFileError(
            "file_locked", "This PDF is password-protected. Remove the password first."
        )
    for page in reader.pages:
        yield page.extract_text()


def row_text(cells: Iterable[Any]) -> str:
    """One table row as a line, cells separated by bars; Word and PowerPoint cells have text."""
    cell_texts = []
    for cell in cells:
        cell_texts.append(cell.text)
    return " | ".join(cell_texts)


def read_docx(content: bytes) -> Iterator[str]:
    """Yield each paragraph, then each table row."""
    check_unzipped_size(content)
    document = docx.Document(io.BytesIO(content))
    for paragraph in document.paragraphs:
        yield paragraph.text
    for table in document.tables:
        for row in table.rows:
            yield row_text(row.cells)


def read_shapes(shapes: Iterable[BaseShape]) -> list[str]:
    """The text in slide shapes, including tables and shapes grouped together."""
    texts = []
    for shape in shapes:
        if isinstance(shape, GroupShape):
            texts.extend(read_shapes(shape.shapes))
        elif isinstance(shape, Shape) and shape.has_text_frame:
            texts.append(shape.text_frame.text)
        elif isinstance(shape, GraphicFrame) and shape.has_table:
            for row in shape.table.rows:
                texts.append(row_text(row.cells))
    return texts


def read_pptx(content: bytes) -> list[str]:
    """Each slide's text, then its speaker notes, where teachers often explain more."""
    check_unzipped_size(content)
    presentation = pptx.Presentation(io.BytesIO(content))
    texts = []
    for slide in presentation.slides:
        texts.extend(read_shapes(slide.shapes))
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame
            if notes is not None:
                texts.append(notes.text)
    return texts


def read_txt(content: bytes) -> Iterator[str]:
    """Yield the whole file as is; teachers on Windows often save in the older Western encoding.

    Markdown is read the same way: its headings and lists are plain text the models read well.
    """
    try:
        yield content.decode("utf-8-sig")
    except UnicodeDecodeError:
        yield content.decode("cp1252", errors="replace")


READERS: dict[str, Callable[[bytes], Iterable[str]]] = {
    ".pdf": read_pdf,
    ".docx": read_docx,
    ".pptx": read_pptx,
    ".txt": read_txt,
    ".md": read_txt,
    ".markdown": read_txt,
}


def check_unzipped_size(content: bytes) -> None:
    """Refuse a zip that claims to unpack to far more than any real document."""
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        unzipped_bytes = sum(member.file_size for member in archive.infolist())
    if unzipped_bytes > MAX_UNZIPPED_BYTES:
        raise UnreadableFileError("file_damaged", DAMAGED_FILE_MESSAGE)


def join_pieces(pieces: Iterable[str]) -> MaterialText:
    """Join non-empty pieces with blank lines, and stop reading once there's more than enough."""
    kept: list[str] = []
    length = 0
    for piece in pieces:
        cleaned = clean_text(piece)
        if cleaned == "":
            continue
        kept.append(cleaned)
        length += len(cleaned) + len(PIECE_SEPARATOR)
        if length > MAX_EXTRACTED_CHARACTERS:
            text = PIECE_SEPARATOR.join(kept)[:MAX_EXTRACTED_CHARACTERS].rstrip()
            return MaterialText(text=text, truncated=True)
    return MaterialText(text=PIECE_SEPARATOR.join(kept), truncated=False)


def clean_text(text: str) -> str:
    """Trim trailing spaces, collapse runs of blank lines, and drop characters Postgres refuses."""
    # Postgres text columns reject NUL, which some PDFs contain
    lines = [line.rstrip() for line in text.replace("\x00", "").splitlines()]
    return re.sub(r"\n{3,}", PIECE_SEPARATOR, "\n".join(lines)).strip()
