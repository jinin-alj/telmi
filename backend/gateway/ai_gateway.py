"""Lets the hosted backend use this laptop's Ollama for chat, and refuses everything else."""

import hmac
import os
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# The backend only ever needs chat; pulling or deleting models must stay local
ALLOWED_PATH = "/api/chat"

# A full session with teacher material is well under this; anything bigger is not ours
MAX_BODY_BYTES = 1_000_000

# Must outlast the backend's own 120-second wait for slow first replies
OLLAMA_TIMEOUT_SECONDS = 180

MIN_KEY_LENGTH = 32

# A connection that sends nothing for this long is closed, so idle ones can't hold threads
GATEWAY_TIMEOUT_SECONDS = 5


class GatewayServer(ThreadingHTTPServer):
    """An HTTP server that remembers the shared key and where Ollama is."""

    def __init__(self, address: tuple[str, int], api_key: str, ollama_url: str) -> None:
        if not ollama_url.startswith(("http://", "https://")):
            raise ValueError("OLLAMA_URL must start with http:// or https://")
        super().__init__(address, GatewayHandler)
        self.api_key = api_key
        self.ollama_url = ollama_url.rstrip("/")


class GatewayHandler(BaseHTTPRequestHandler):
    """Checks each request, then passes chat requests through to Ollama."""

    timeout = GATEWAY_TIMEOUT_SECONDS

    def do_POST(self) -> None:
        """Forward an authorised chat request to Ollama and relay its answer."""
        server = self.server
        if not isinstance(server, GatewayServer):
            raise TypeError("GatewayHandler needs a GatewayServer")

        if self.path != ALLOWED_PATH:
            self.send_json(404, b'{"error": "not found"}')
            return

        expected = f"Bearer {server.api_key}"
        given = self.headers.get("Authorization", "")
        # Constant-time comparison so the key can't be guessed from response timing
        if not hmac.compare_digest(given.encode(), expected.encode()):
            self.send_json(401, b'{"error": "unauthorised"}')
            return

        # Chunked uploads have no length; the backend always sends one, so refuse them
        if self.headers.get("Content-Length") is None:
            self.send_json(411, b'{"error": "length required"}')
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = -1
        if length < 0 or length > MAX_BODY_BYTES:
            self.send_json(413, b'{"error": "request too large"}')
            return

        body = self.rfile.read(length)
        # The scheme was checked at startup, so this can only ever reach Ollama over HTTP
        request = urllib.request.Request(  # noqa: S310
            server.ollama_url + ALLOWED_PATH,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=OLLAMA_TIMEOUT_SECONDS) as response:  # noqa: S310
                self.send_json(response.status, response.read())
        except urllib.error.HTTPError as error:
            self.send_json(error.code, error.read())
        except (urllib.error.URLError, TimeoutError) as error:
            self.log_error("Ollama unreachable: %s", error)
            self.send_json(502, b'{"error": "ollama unreachable"}')

    def do_GET(self) -> None:
        """Refuse everything except chat, including Ollama's model list."""
        self.send_json(404, b'{"error": "not found"}')

    def do_DELETE(self) -> None:
        """Refuse deletes, so nobody can remove the laptop's models."""
        self.send_json(404, b'{"error": "not found"}')

    def do_PUT(self) -> None:
        """Refuse uploads."""
        self.send_json(404, b'{"error": "not found"}')

    def send_json(self, status: int, body: bytes) -> None:
        """Write a JSON response with the right headers."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    """Start the gateway on localhost; the tunnel is what makes it reachable."""
    api_key = os.environ.get("GATEWAY_API_KEY", "")
    if len(api_key) < MIN_KEY_LENGTH:
        print(f"Set GATEWAY_API_KEY to a random value of at least {MIN_KEY_LENGTH} characters.")
        sys.exit(1)

    ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
    port = int(os.environ.get("GATEWAY_PORT", "8787"))
    server = GatewayServer(("127.0.0.1", port), api_key, ollama_url)
    print(f"AI gateway on http://127.0.0.1:{port}, forwarding chat to {ollama_url}")
    server.serve_forever()


if __name__ == "__main__":
    main()
