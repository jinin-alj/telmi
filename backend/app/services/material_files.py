"""Turn a teacher's uploaded file into plain text for the unit material box.

Nothing is stored: the text goes back to the app, the teacher checks and edits it,
and the existing "add unit" request saves it exactly like pasted material.
"""

import io
import re
import zipfile
from collections.abc import Callable, Iterator
from pathlib import PurePath

import docx
import pptx
from pypdf import PdfReader

from app.schemas.classrooms import MaterialText

# Slides full of pictures can be large even when their text is short
MAX_FILE_BYTES = 20 * 1024 * 1024

# Word and PowerPoint files are zips; refuse ones that would unpack to far more than a document
MAX_UNZIPPED_BYTES = 200 * 1024 * 1024

# Well above a unit's limit, so the teacher can choose what to keep from a long file,
# but small enough that one upload can't flood the app
MAX_EXTRACTED_CHARACTERS = 60000

PIECE_SEPARATOR = "\n\n"

DAMAGED_FILE_MESSAGE = "We couldn't open this file. Try saving it again, or paste the text instead."
NO_TEXT_MESSAGE = (
    "We couldn't find any text in this file. If it's a scan or a photo, paste the text instead."
)


class UnsupportedFileError(Exception):
    """The file type isn't one we can read."""


class FileTooLargeError(Exception):
    """The upload is bigger than we accept."""


class UnreadableFileError(Exception):
    """The file is damaged, locked, or has no text we can find."""


def read_material_file(file_name: str, content: bytes) -> MaterialText:
    """Read the text from a PDF, Word, PowerPoint, plain text or Markdown file."""
    if len(content) > MAX_FILE_BYTES:
        raise FileTooLargeError(f"Files can be at most {MAX_FILE_BYTES // (1024 * 1024)} MB.")

    reader = READERS.get(PurePath(file_name).suffix.lower())
    if reader is None:
        raise UnsupportedFileError(
            "Upload a PDF, Word (.docx), PowerPoint (.pptx), text (.txt) or Markdown (.md) file."
        )

    try:
        material = join_pieces(reader(content))
    except UnreadableFileError:
        raise
    # Each parser fails differently on a damaged file, and all of them mean the same to a teacher
    except Exception as error:
        raise UnreadableFileError(DAMAGED_FILE_MESSAGE) from error

    if material.text == "":
        raise UnreadableFileError(NO_TEXT_MESSAGE)
    return material


def read_pdf(content: bytes) -> Iterator[str]:
    """Yield the text of each page; scanned pages have none."""
    reader = PdfReader(io.BytesIO(content))
    if reader.is_encrypted:
        raise UnreadableFileError("This PDF is password-protected. Remove the password first.")
    for page in reader.pages:
        yield page.extract_text()


def read_docx(content: bytes) -> Iterator[str]:
    """Yield each paragraph, then each table row."""
    check_unzipped_size(content)
    document = docx.Document(io.BytesIO(content))
    for paragraph in document.paragraphs:
        yield paragraph.text
    for table in document.tables:
        for row in table.rows:
            yield " | ".join(cell.text for cell in row.cells)


def read_pptx(content: bytes) -> Iterator[str]:
    """Yield each slide's text, then its speaker notes, where teachers often explain more."""
    check_unzipped_size(content)
    presentation = pptx.Presentation(io.BytesIO(content))
    for slide in presentation.slides:
        for shape in slide.shapes:
            if shape.has_text_frame:
                yield shape.text_frame.text
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame
            if notes is not None:
                yield notes.text


def read_txt(content: bytes) -> Iterator[str]:
    """Yield the whole file as is; teachers on Windows often save in the older Western encoding.

    Markdown is read the same way: its headings and lists are plain text the models read well.
    """
    try:
        yield content.decode("utf-8-sig")
    except UnicodeDecodeError:
        yield content.decode("cp1252", errors="replace")


READERS: dict[str, Callable[[bytes], Iterator[str]]] = {
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
        raise UnreadableFileError(DAMAGED_FILE_MESSAGE)


def join_pieces(pieces: Iterator[str]) -> MaterialText:
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
