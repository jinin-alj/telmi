import json
import socket
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import pytest

from gateway.ai_gateway import GATEWAY_TIMEOUT_SECONDS, MAX_BODY_BYTES, GatewayServer

API_KEY = "k" * 40
CHAT_REPLY = {"message": {"role": "assistant", "content": "Why do plants need light?"}}


class FakeOllamaHandler(BaseHTTPRequestHandler):
    """Answers chat like Ollama and records every path it is asked for."""

    def do_POST(self) -> None:
        self.server.seen_paths.append(self.path)  # type: ignore[attr-defined]
        self.rfile.read(int(self.headers.get("Content-Length", "0")))
        body = json.dumps(CHAT_REPLY).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        """Keep test output quiet."""


def start_in_background(server: ThreadingHTTPServer) -> str:
    """Run a server on a free port in a thread and return its base URL."""
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address[0], server.server_address[1]
    return f"http://{host!s}:{port}"


@pytest.fixture
def fake_ollama() -> Iterator[ThreadingHTTPServer]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), FakeOllamaHandler)
    server.seen_paths = []  # type: ignore[attr-defined]
    start_in_background(server)
    yield server
    server.shutdown()


@pytest.fixture
def gateway_url(fake_ollama: ThreadingHTTPServer) -> Iterator[str]:
    ollama_url = f"http://127.0.0.1:{fake_ollama.server_address[1]}"
    server = GatewayServer(("127.0.0.1", 0), API_KEY, ollama_url)
    url = start_in_background(server)
    yield url
    server.shutdown()


def authorised() -> dict[str, str]:
    return {"Authorization": f"Bearer {API_KEY}"}


def test_forwards_an_authorised_chat_request(gateway_url: str) -> None:
    response = httpx.post(
        f"{gateway_url}/api/chat", json={"model": "llama3.1:8b"}, headers=authorised()
    )

    assert response.status_code == 200
    assert response.json() == CHAT_REPLY


def test_refuses_a_missing_or_wrong_key(gateway_url: str) -> None:
    missing = httpx.post(f"{gateway_url}/api/chat", json={})
    wrong = httpx.post(f"{gateway_url}/api/chat", json={}, headers={"Authorization": "Bearer nope"})

    assert missing.status_code == 401
    assert wrong.status_code == 401


@pytest.mark.parametrize("path", ["/api/pull", "/api/delete", "/api/generate", "/"])
def test_refuses_every_ollama_endpoint_except_chat(
    gateway_url: str, fake_ollama: ThreadingHTTPServer, path: str
) -> None:
    response = httpx.post(f"{gateway_url}{path}", json={}, headers=authorised())

    assert response.status_code == 404
    assert fake_ollama.seen_paths == []  # type: ignore[attr-defined]


def test_refuses_reads_and_deletes(gateway_url: str) -> None:
    assert httpx.get(f"{gateway_url}/api/tags", headers=authorised()).status_code == 404
    assert httpx.delete(f"{gateway_url}/api/delete", headers=authorised()).status_code == 404


def test_refuses_oversized_requests(gateway_url: str) -> None:
    oversized = b"x" * (MAX_BODY_BYTES + 1)

    response = httpx.post(f"{gateway_url}/api/chat", content=oversized, headers=authorised())

    assert response.status_code == 413


def test_reports_ollama_being_down_as_bad_gateway() -> None:
    # Nothing listens on this port, so the forward fails
    server = GatewayServer(("127.0.0.1", 0), API_KEY, "http://127.0.0.1:9")
    url = start_in_background(server)
    try:
        response = httpx.post(f"{url}/api/chat", json={}, headers=authorised())
    finally:
        server.shutdown()

    assert response.status_code == 502


def test_refuses_to_start_with_a_non_http_ollama_address() -> None:
    with pytest.raises(ValueError):
        GatewayServer(("127.0.0.1", 0), API_KEY, "file:///etc/passwd")


def test_silent_connections_are_closed(gateway_url: str) -> None:
    host, port = gateway_url.removeprefix("http://").split(":")
    with socket.create_connection((host, int(port))) as connection:
        connection.settimeout(GATEWAY_TIMEOUT_SECONDS + 5)
        # Say nothing; the gateway should hang up rather than wait for ever
        assert connection.recv(1024) == b""


def test_chat_without_a_declared_length_is_refused(gateway_url: str) -> None:
    response = httpx.post(
        f"{gateway_url}/api/chat",
        content=iter([b'{"model": "x"}']),
        headers=authorised(),
    )

    assert response.status_code == 411
