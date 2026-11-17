import threading
import time

import pytest
from argon2 import PasswordHasher

from app.security import passwords
from app.security.passwords import hash_password, verify_password


def test_correct_password_verifies() -> None:
    password_hash = hash_password("correct-horse-battery")

    assert verify_password("correct-horse-battery", password_hash) is True


def test_wrong_password_fails() -> None:
    password_hash = hash_password("correct-horse-battery")

    assert verify_password("wrong-password", password_hash) is False


def test_same_password_hashes_differently_each_time() -> None:
    assert hash_password("same-password") != hash_password("same-password")


def test_malformed_hash_fails_instead_of_crashing() -> None:
    assert verify_password("anything", "not-a-hash") is False


def test_hashing_uses_little_enough_memory_for_a_small_server() -> None:
    # 64 MiB per hash, the library default, crashes a 512 MB server after a few logins
    assert passwords.password_hasher.memory_cost <= 19456
    assert passwords.password_hasher.parallelism == 1


def test_only_two_passwords_are_hashed_at_once(monkeypatch: pytest.MonkeyPatch) -> None:
    slow_hasher = SlowHasher()
    monkeypatch.setattr(passwords, "password_hasher", slow_hasher)

    threads = []
    for _number in range(6):
        threads.append(threading.Thread(target=hash_password, args=("correct-horse-battery",)))
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert slow_hasher.most_at_once == 2


def test_old_hashes_are_flagged_for_an_upgrade() -> None:
    old_hash = PasswordHasher(memory_cost=65536, time_cost=3, parallelism=4).hash("secret-words")

    assert passwords.needs_rehash(old_hash) is True
    assert passwords.needs_rehash(hash_password("secret-words")) is False
    assert passwords.needs_rehash("not-a-hash") is False


class SlowHasher:
    """Stands in for Argon2 and records how many hashes ran at the same time."""

    def __init__(self) -> None:
        self.running = 0
        self.most_at_once = 0
        self.lock = threading.Lock()

    def hash(self, password: str) -> str:
        """Pretend to work for a moment while counting overlapping calls."""
        with self.lock:
            self.running += 1
            self.most_at_once = max(self.most_at_once, self.running)
        time.sleep(0.05)
        with self.lock:
            self.running -= 1
        return "hashed"
