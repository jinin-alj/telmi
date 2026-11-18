from fastapi import Request, Response, status
from starlette.middleware.base import RequestResponseEndpoint

from app.api_errors import error_json
from app.services.material_files import MAX_FILE_BYTES

# Every JSON request this API takes fits easily; a bigger body is a mistake or an attack
DEFAULT_BODY_LIMIT = 64 * 1024
# The largest drawing the schema allows is about 400 KB of JSON
DRAWING_BODY_LIMIT = 1024 * 1024
# The file itself plus the form's wrapping around it
UPLOAD_BODY_LIMIT = MAX_FILE_BYTES + 1024 * 1024


def body_limit_for(path: str) -> int:
    """The largest body this route accepts, in bytes."""
    if path.endswith("/material-text"):
        return UPLOAD_BODY_LIMIT
    if path.endswith("/drawing-text"):
        return DRAWING_BODY_LIMIT
    return DEFAULT_BODY_LIMIT


async def limit_body_size(request: Request, call_next: RequestResponseEndpoint) -> Response:
    """Refuse a body over the route's limit before it is read into memory or onto disk."""
    # A body sent in chunks has no size to check up front, and the app never sends one that way
    if "transfer-encoding" in request.headers:
        return error_json(
            status.HTTP_411_LENGTH_REQUIRED, "length_required", "Send the request with its size."
        )

    # The server never reads past the declared size, so checking it is enough
    declared_length = request.headers.get("content-length", "0")
    if declared_length.isdigit() and int(declared_length) > body_limit_for(request.url.path):
        return error_json(
            status.HTTP_413_CONTENT_TOO_LARGE, "request_too_large", "That request is too big."
        )
    return await call_next(request)
