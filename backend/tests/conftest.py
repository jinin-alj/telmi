import os
from collections.abc import Iterator

# Settings are read at import time, so test values must be set before importing the app
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256-signing"
# Tests never call a real AI service, whatever a developer's .env says
os.environ["AI_PROVIDER"] = "ollama"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.engine import Engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database import Base, get_db  # noqa: E402
from app.dependencies import get_buddy_model, get_checker_model, get_vision_model  # noqa: E402
from app.main import create_app  # noqa: E402
from tests.fakes import FakeChatModel  # noqa: E402


def build_test_engine() -> Engine:
    """In-memory SQLite needs one shared connection; Postgres (in CI) uses a normal pool."""
    if TEST_DATABASE_URL.startswith("sqlite"):
        return create_engine(
            TEST_DATABASE_URL,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    return create_engine(TEST_DATABASE_URL)


test_engine = build_test_engine()
TestSessionLocal = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)


@pytest.fixture
def db() -> Iterator[Session]:
    """Fresh empty tables for every test."""
    Base.metadata.create_all(test_engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(test_engine)


@pytest.fixture
def fake_chat_model() -> FakeChatModel:
    """A language model stand-in that returns whatever the test queues."""
    return FakeChatModel()


@pytest.fixture
def client(db: Session, fake_chat_model: FakeChatModel) -> Iterator[TestClient]:
    """API client that uses the test database session and the fake model."""
    app = create_app()

    def override_get_db() -> Iterator[Session]:
        yield db

    def override_get_chat_model() -> FakeChatModel:
        return fake_chat_model

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_buddy_model] = override_get_chat_model
    app.dependency_overrides[get_checker_model] = override_get_chat_model
    app.dependency_overrides[get_vision_model] = override_get_chat_model
    with TestClient(app) as test_client:
        yield test_client
