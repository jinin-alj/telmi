from typing import Any

import pytest
import sentry_sdk

from app import error_reporting
from app.config import get_settings
from app.error_reporting import scrub_event, start_error_reporting


class RecordedInit:
    """Stands in for sentry_sdk.init and remembers the options it was given."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def __call__(self, **options: Any) -> None:
        """Record one call instead of contacting Sentry."""
        self.calls.append(options)


def test_crash_reports_lose_anything_personal() -> None:
    event: Any = {
        "exception": {"values": [{"type": "KeyError"}]},
        "user": {"ip_address": "203.0.113.5"},
        "request": {
            "url": "https://api.example/sessions/abc/turns",
            "method": "POST",
            "data": {"text": "My name is Ana and plants eat soil"},
            "cookies": {"session": "secret"},
            "headers": {"Authorization": "Bearer secret"},
            "query_string": "token=secret",
        },
    }

    scrubbed: Any = scrub_event(event, {})

    assert "user" not in scrubbed
    assert scrubbed["request"] == {
        "url": "https://api.example/sessions/abc/turns",
        "method": "POST",
    }
    assert scrubbed["exception"] == {"values": [{"type": "KeyError"}]}


def test_nothing_is_sent_without_a_sentry_address(monkeypatch: pytest.MonkeyPatch) -> None:
    recorded = RecordedInit()
    monkeypatch.setattr(sentry_sdk, "init", recorded)
    settings = get_settings().model_copy(update={"sentry_dsn": None})

    assert start_error_reporting(settings) is False
    assert recorded.calls == []


def test_sentry_is_set_up_to_send_no_personal_data(monkeypatch: pytest.MonkeyPatch) -> None:
    recorded = RecordedInit()
    monkeypatch.setattr(sentry_sdk, "init", recorded)
    settings = get_settings().model_copy(
        update={"sentry_dsn": "https://key@o1.ingest.de.sentry.io/1", "render_git_commit": "abc123"}
    )

    assert start_error_reporting(settings) is True
    options = recorded.calls[0]
    assert options["data_collection"] is error_reporting.NO_PERSONAL_DATA
    assert options["send_default_pii"] is False
    assert options["include_local_variables"] is False
    assert options["max_request_body_size"] == "never"
    assert options["traces_sample_rate"] == 0.0
    assert options["before_send"] is scrub_event
    assert options["release"] == "abc123"
