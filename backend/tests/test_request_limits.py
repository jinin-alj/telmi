from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.security.rate_limit import RateLimiter
from tests.helpers import TEST_PASSWORD, sign_up_as


def test_refuses_a_request_body_over_the_limit(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        content=b"x" * (200 * 1024),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 413


def test_refuses_a_body_sent_without_a_declared_size(client: TestClient) -> None:
    def chunks() -> Iterator[bytes]:
        for _number in range(100):
            yield b"x" * 4096

    response = client.post(
        "/auth/register", content=chunks(), headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 411


def test_small_requests_still_work(client: TestClient) -> None:
    sign_up_as(client, "ana_g", "student")


def test_limiter_allows_up_to_the_limit_then_refuses() -> None:
    limiter = RateLimiter(max_attempts=2, window_seconds=60)

    assert limiter.allow("ana_g") is True
    assert limiter.allow("ana_g") is True
    assert limiter.allow("ana_g") is False
    # Other keys have their own count
    assert limiter.allow("bea_m") is True


class FakeClock:
    """A clock the test moves forward by hand."""

    def __init__(self) -> None:
        self.seconds = 1000.0

    def monotonic(self) -> float:
        """The current fake time."""
        return self.seconds


def test_limiter_forgets_attempts_once_the_window_passes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clock = FakeClock()
    monkeypatch.setattr("app.security.rate_limit.time.monotonic", clock.monotonic)
    limiter = RateLimiter(max_attempts=1, window_seconds=60)
    limiter.allow("ana_g")

    clock.seconds += 61

    assert limiter.allow("ana_g") is True


def test_repeated_wrong_passwords_are_slowed_down(client: TestClient) -> None:
    sign_up_as(client, "ana_g", "student")
    statuses = []
    for _attempt in range(11):
        response = client.post(
            "/auth/login", json={"username": "ana_g", "password": "wrong-password"}
        )
        statuses.append(response.status_code)

    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429
    assert "Retry-After" in response.headers
    # The real password is refused too until the wait is over, so guessing gains nothing
    right = client.post("/auth/login", json={"username": "ana_g", "password": TEST_PASSWORD})
    assert right.status_code == 429
