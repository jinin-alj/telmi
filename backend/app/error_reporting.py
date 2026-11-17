import sentry_sdk
from sentry_sdk.types import DataCollectionUserOptions, Event, Hint

from app.config import Settings

# Parts of a request that could hold students' words, passwords or tokens
PRIVATE_REQUEST_FIELDS = ["data", "cookies", "headers", "query_string"]

# Sentry's defaults collect most of this, so every category about people is switched off by name
NO_PERSONAL_DATA: DataCollectionUserOptions = {
    "user_info": False,
    "cookies": {"mode": "off"},
    "http_headers": {"request": {"mode": "off"}},
    "http_bodies": [],
    "url_query_params": {"mode": "off"},
    "gen_ai": {"inputs": False, "outputs": False},
    "database_query_data": False,
    "queues": False,
    "stack_frame_variables": False,
}


def scrub_event(event: Event, hint: Hint) -> Event:
    """Remove anything personal from a crash report before it leaves the server."""
    event.pop("user", None)
    request = event.get("request")
    if request is not None:
        for field in PRIVATE_REQUEST_FIELDS:
            request.pop(field, None)
    return event


def start_error_reporting(settings: Settings) -> bool:
    """Send crashes to Sentry when SENTRY_DSN is set; returns whether reporting is on."""
    if not settings.sentry_dsn:
        return False
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        release=settings.render_git_commit,
        # The users are minors: no names, addresses, request bodies or local variables
        data_collection=NO_PERSONAL_DATA,
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        # Crashes only; tracing would send a record of every request
        traces_sample_rate=0.0,
        before_send=scrub_event,
    )
    return True
