from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api_errors import ApiError, send_api_error, send_validation_error
from app.body_limit import limit_body_size
from app.config import get_settings
from app.error_reporting import start_error_reporting
from app.routers import auth, classrooms, dashboard, feedback, study_sessions
from app.security.rate_limit import RateLimiter

# Generous per address, since a whole class may share one school connection
LOGINS_PER_ADDRESS = 60
LOGINS_PER_USERNAME = 10
LOGIN_WINDOW_SECONDS = 5 * 60
SIGN_UPS_PER_ADDRESS = 60
SIGN_UP_WINDOW_SECONDS = 60 * 60
REPORTS_PER_PERSON = 5
REPORT_WINDOW_SECONDS = 60 * 60


def create_app() -> FastAPI:
    """Build the FastAPI application with all routes attached."""
    app = FastAPI(title="Telmi API", version="0.1.0")

    # Every error carries a code, so the app can show it in the person's language
    app.add_exception_handler(ApiError, send_api_error)
    app.add_exception_handler(RequestValidationError, send_validation_error)

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
    app.state.feedback_limiter = RateLimiter(REPORTS_PER_PERSON, REPORT_WINDOW_SECONDS)

    @app.get("/health")
    def read_health() -> dict[str, str]:
        """Report that the API is running, for load balancers and uptime checks."""
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(classrooms.router)
    app.include_router(study_sessions.router)
    app.include_router(dashboard.router)
    app.include_router(feedback.router)
    return app


start_error_reporting(get_settings())
app = create_app()
