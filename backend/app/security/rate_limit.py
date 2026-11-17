import threading
import time

from fastapi import HTTPException, status

# Long enough to make guessing passwords slow, short enough not to lock out a real student
RETRY_AFTER_SECONDS = 60

# Once this many keys are tracked, keys with no recent attempts are dropped to save memory
CLEANUP_AFTER_KEYS = 10000


class RateLimiter:
    """Counts attempts per key over a rolling window, in memory; enough for one server process."""

    def __init__(self, max_attempts: int, window_seconds: float) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.attempts: dict[str, list[float]] = {}
        self.lock = threading.Lock()

    def allow(self, key: str) -> bool:
        """Record an attempt for the key; False once it has used up its attempts."""
        now = time.monotonic()
        with self.lock:
            recent = self.recent_attempts(key, now)
            if len(recent) >= self.max_attempts:
                self.attempts[key] = recent
                return False
            recent.append(now)
            self.attempts[key] = recent
            if len(self.attempts) > CLEANUP_AFTER_KEYS:
                self.forget_quiet_keys(now)
            return True

    def recent_attempts(self, key: str, now: float) -> list[float]:
        """The key's attempts that are still inside the window."""
        recent = []
        for moment in self.attempts.get(key, []):
            if now - moment < self.window_seconds:
                recent.append(moment)
        return recent

    def forget_quiet_keys(self, now: float) -> None:
        """Drop keys whose attempts are all older than the window."""
        quiet_keys = []
        for key in self.attempts:
            if len(self.recent_attempts(key, now)) == 0:
                quiet_keys.append(key)
        for key in quiet_keys:
            del self.attempts[key]


def check_rate_limit(limiter: RateLimiter, key: str) -> None:
    """Answer 429 once this key has used up its attempts."""
    if not limiter.allow(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many tries. Wait a minute, then try again.",
            headers={"Retry-After": str(RETRY_AFTER_SECONDS)},
        )
