from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.body_limit import limit_body_size
from app.config import get_settings
from app.routers import auth, classrooms, dashboard, study_sessions
from app.security.rate_limit import RateLimiter

# Generous per address, since a whole class may share one school connection
LOGINS_PER_ADDRESS = 60
LOGINS_PER_USERNAME = 10
LOGIN_WINDOW_SECONDS = 5 * 60
SIGN_UPS_PER_ADDRESS = 60
SIGN_UP_WINDOW_SECONDS = 60 * 60


def create_app() -> FastAPI:
    """Build the FastAPI application with all routes attached."""
    app = FastAPI(title="Telmi API", version="0.1.0")

    app.add_middleware(BaseHTTPMiddleware, dispatch=limit_body_size)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origin_list(),
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # Kept on the app, so each app (and each test) starts with fresh counts
    app.state.login_address_limiter = RateLimiter(LOGINS_PER_ADDRESS, LOGIN_WINDOW_SECONDS)
    app.state.login_username_limiter = RateLimiter(LOGINS_PER_USERNAME, LOGIN_WINDOW_SECONDS)
    app.state.sign_up_limiter = RateLimiter(SIGN_UPS_PER_ADDRESS, SIGN_UP_WINDOW_SECONDS)

    @app.get("/health")
    def read_health() -> dict[str, str]:
        """Report that the API is running, for load balancers and uptime checks."""
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(classrooms.router)
    app.include_router(study_sessions.router)
    app.include_router(dashboard.router)
    return app


app = create_app()
