import threading

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# Argon2id at OWASP's minimum (19 MiB, 2 passes); the 64 MiB default is too much for a 512 MB server
password_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)

# At most two hashes run at once, so a class logging in together can't use up the memory
hashing_slots = threading.BoundedSemaphore(2)

# Checked when the username doesn't exist so failed logins take the same time either way
DUMMY_PASSWORD_HASH = password_hasher.hash("not-a-real-password")


def hash_password(plain_password: str) -> str:
    """Return an Argon2id hash that is safe to store."""
    with hashing_slots:
        return password_hasher.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Check a password against a stored hash without raising."""
    with hashing_slots:
        try:
            return password_hasher.verify(password_hash, plain_password)
        except (VerificationError, InvalidHashError):
            return False


def needs_rehash(password_hash: str) -> bool:
    """True for hashes made with older, heavier settings, so they're upgraded at the next login."""
    try:
        return password_hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return False
