from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _hostname(host_header: str) -> str:
    """Strip the port from a Host header, keeping bracketed IPv6 literals intact."""
    if host_header.startswith("["):
        return host_header[: host_header.find("]") + 1]
    return host_header.rsplit(":", 1)[0] if ":" in host_header else host_header


class GuardMiddleware:
    """Localhost-only guard.

    Any web page can send requests to 127.0.0.1, so we require an allowed Host
    (blocks DNS rebinding) and an allowed Origin (blocks drive-by requests from
    other sites). State-changing requests must carry an Origin.
    """

    def __init__(self, app: ASGIApp, allowed_origins: list[str], allowed_hosts: list[str]) -> None:
        self.app = app
        self.allowed_origins = set(allowed_origins)
        self.allowed_hosts = set(allowed_hosts)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        host = _hostname(headers.get("host", ""))
        origin = headers.get("origin")
        method = scope.get("method", "GET")

        reason: str | None = None
        if host not in self.allowed_hosts:
            reason = "Host not allowed"
        elif origin is not None and origin not in self.allowed_origins:
            reason = "Origin not allowed"
        elif origin is None and scope["type"] == "http" and method not in SAFE_METHODS:
            reason = "Origin required"

        if reason is None:
            await self.app(scope, receive, send)
        elif scope["type"] == "http":
            await JSONResponse({"detail": reason}, status_code=403)(scope, receive, send)
        else:
            await send({"type": "websocket.close", "code": 1008})
