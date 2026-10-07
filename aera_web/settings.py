from dataclasses import dataclass
import os
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    origin: str = "http://127.0.0.1:8765"
    backend_enabled: bool = False
    database_url: str = ""
    redis_url: str = ""
    app_secret: str = ""
    oidc_client_id: str = ""
    oidc_client_secret: str = ""
    login_method: str = "oidc"
    widget_secret: str = ""
    bot_username: str = "AERAVPN_BOT"
    subscription_origin: str = ""

    @property
    def secure(self):
        return self.origin.startswith("https://")

    @property
    def auth_enabled(self):
        return self.backend_enabled and (True if self.login_method == "bot" else bool(self.widget_secret) if self.login_method == "widget" else bool(self.oidc_client_id and self.oidc_client_secret))

    @property
    def cookie(self):
        return "__Host-aera-session" if self.secure else "aera-local-session"

    @classmethod
    def from_env(cls):
        value = cls(
            origin=os.getenv("AERA_WEB_ORIGIN", "http://127.0.0.1:8765").rstrip("/"),
            backend_enabled=os.getenv("AERA_WEB_BACKEND", "0") == "1",
            database_url=os.getenv("AERA_WEB_DATABASE_URL", ""),
            redis_url=os.getenv("AERA_WEB_REDIS_URL", ""),
            app_secret=os.getenv("AERA_WEB_APP_SECRET", ""),
            oidc_client_id=os.getenv("AERA_WEB_OIDC_CLIENT_ID", ""),
            oidc_client_secret=os.getenv("AERA_WEB_OIDC_CLIENT_SECRET", ""),
            login_method=os.getenv("AERA_WEB_LOGIN_METHOD", "oidc"),
            widget_secret=os.getenv("AERA_WEB_WIDGET_SECRET", ""),
            bot_username=os.getenv("AERA_WEB_BOT_USERNAME", "AERAVPN_BOT"),
            subscription_origin=os.getenv("AERA_WEB_SUBSCRIPTION_ORIGIN", "").rstrip("/"),
        )
        parsed = urlsplit(value.origin)
        if value.login_method not in {"oidc", "widget", "bot"}:
            raise ValueError("Invalid login method")
        if value.widget_secret:
            if len(value.widget_secret) != 64:
                raise ValueError("Invalid widget signing key")
            bytes.fromhex(value.widget_secret)
        if parsed.scheme not in {"https", "http"} or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password:
            raise ValueError("AERA_WEB_ORIGIN must be a bare origin")
        if not value.secure and parsed.hostname not in {"127.0.0.1", "localhost"}:
            raise ValueError("Public web origins require HTTPS")
        if value.backend_enabled and (not value.secure or not value.database_url or not value.redis_url or len(value.app_secret) < 32):
            raise ValueError("Backend mode requires HTTPS, a read-only database, Redis and APP_SECRET")
        if not value.bot_username.replace("_", "").isalnum():
            raise ValueError("Invalid bot username")
        if value.subscription_origin:
            sub = urlsplit(value.subscription_origin)
            if sub.scheme != "https" or not sub.hostname or sub.path or sub.query or sub.fragment or sub.username or sub.password:
                raise ValueError("Subscription origin must be a bare HTTPS origin")
        return value
