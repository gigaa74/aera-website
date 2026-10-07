import logging
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, PlainTextResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .settings import Settings

STATIC = Path(__file__).parent / "static"
PAGES = {"/", "/plans", "/setup", "/account", "/support", "/support/admin", "/privacy", "/terms", "/cookies", "/payments/success", "/payments/failure"}


def create_app(settings=None, repository=None, auth=None):
    settings = settings or Settings.from_env()
    resources = []
    if settings.backend_enabled and repository is None:
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from redis.asyncio import Redis
        from .repository import Repository
        from .auth import Auth
        engine = create_async_engine(settings.database_url, pool_pre_ping=True, hide_parameters=True)
        redis = Redis.from_url(settings.redis_url)
        repository = Repository(async_sessionmaker(engine, expire_on_commit=False), settings.app_secret, settings.subscription_origin)
        auth = Auth(settings, redis)
        resources = [engine.dispose, redis.aclose]

    @asynccontextmanager
    async def lifespan(app):
        yield
        for close in resources:
            await close()

    app = FastAPI(title="AERA Web", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=[urlsplit(settings.origin).hostname], www_redirect=False)

    @app.middleware("http")
    async def boundary(request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"} and request.headers.get("origin") != settings.origin:
            response = JSONResponse({"detail": "Недопустимый источник запроса."}, status_code=403)
        else:
            try:
                response = await call_next(request)
            except Exception as error:
                # Never log OAuth code, connection strings, request URLs or exception text.
                logging.getLogger("aera_web").error("request_failed type=%s", type(error).__name__)
                response = JSONResponse({"detail": "Сервис временно недоступен. Попробуйте позже."}, status_code=503)
        response.headers.update({
            "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
        })
        if settings.secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        if request.url.path == "/checkout":
            del response.headers["X-Frame-Options"]
            response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors https://web.telegram.org https://*.telegram.org; base-uri 'none'; form-action 'self'; object-src 'none'"
        if request.url.path == "/auth/start" and settings.login_method == "widget":
            response.headers["Content-Security-Policy"] = "default-src 'none'; script-src https://telegram.org; frame-src https://oauth.telegram.org; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
        return response

    from .support_routes import install_support
    install_support(app, settings, repository, auth)

    def require_backend():
        if not repository or not auth:
            raise HTTPException(503, "Кабинет ещё не подключён. Данные доступны в Telegram-боте.")

    async def account(request, connection=False):
        require_backend()
        user_id = await auth.user_id(request.cookies.get(settings.cookie))
        if not user_id:
            raise HTTPException(401, "Войдите через Telegram.")
        result = await repository.account(user_id, include_connection=connection)
        if result is None:
            raise HTTPException(401, "Сессия недействительна. Войдите заново.")
        return result

    @app.get("/api/web/config")
    async def config():
        return {"auth_enabled": settings.auth_enabled, "backend_enabled": settings.backend_enabled,
                "login_method": settings.login_method,
                "sales_enabled": False, "bot_url": "https://t.me/" + settings.bot_username}

    @app.get("/api/web/plans")
    async def plans():
        if not repository:
            return JSONResponse({"detail": "Актуальные тарифы временно недоступны."}, status_code=503)
        return {"plans": await repository.catalog(), "source": "database"}

    @app.get("/api/web/account")
    async def me(request: Request):
        return await account(request)

    @app.post("/api/web/connection")
    async def connection(request: Request):
        value = await account(request, connection=True)
        if not value.get("connection"):
            raise HTTPException(409, "Ссылка пока недоступна. Проверьте статус подписки или обратитесь в поддержку.")
        return {"connection": value["connection"]}

    @app.post("/api/web/logout")
    async def logout(request: Request):
        require_backend()
        await auth.logout(request.cookies.get(settings.cookie))
        response = JSONResponse({"ok": True})
        response.delete_cookie(settings.cookie, path="/", secure=settings.secure, httponly=True, samesite="lax")
        return response

    @app.get("/auth/start")
    async def start(request: Request):
        require_backend()
        if not settings.auth_enabled:
            return RedirectResponse("/account?login=unavailable", status_code=303)
        if settings.login_method == "bot":
            return RedirectResponse("/account", status_code=303)
        await auth.limit(request.client.host if request.client else "unknown")
        url, binding = await auth.start()
        if settings.login_method == "widget":
            from html import escape
            response = HTMLResponse('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход — AERA VPN</title><link rel="stylesheet" href="/assets/style.css"><body><main class="container"><h1>Вход через Telegram</h1><p>Подтвердите вход своим аккаунтом Telegram.</p><script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login="' + escape(settings.bot_username, quote=True) + '" data-size="large" data-auth-url="' + escape(url, quote=True) + '" data-userpic="false"></script><p><a href="/account">Вернуться в кабинет</a></p></main></body></html>')
        else:
            response = RedirectResponse(url, status_code=303)
        response.set_cookie("aera-login", binding, max_age=300, httponly=True, secure=settings.secure, samesite="lax", path="/auth")
        return response

    @app.get("/auth/callback")
    async def callback(request: Request):
        require_backend()
        if not settings.auth_enabled:
            return RedirectResponse("/account?login=unavailable", status_code=303)
        if settings.login_method == "bot":
            return RedirectResponse("/account?login=failed", status_code=303)
        try:
            await auth.limit(request.client.host if request.client else "unknown")
            if settings.login_method == "widget":
                identity = await auth.finish_widget(request.query_params.multi_items(), request.cookies.get("aera-login"))
            else:
                identity = await auth.finish(request.query_params.get("state"), request.query_params.get("code"), request.cookies.get("aera-login"))
            user_id = await repository.find_user(identity)
            if not user_id:
                response = RedirectResponse("/account?login=unknown", status_code=303)
            else:
                token = await auth.session(user_id)
                # Re-authentication replaces this browser's previous session.
                await auth.logout(request.cookies.get(settings.cookie))
                response = RedirectResponse("/account", status_code=303)
                response.set_cookie(settings.cookie, token, max_age=43200, httponly=True, secure=settings.secure, samesite="lax", path="/")
        except HTTPException:
            response = RedirectResponse("/account?login=failed", status_code=303)
        response.delete_cookie("aera-login", path="/auth", secure=settings.secure, httponly=True, samesite="lax")
        return response

    @app.post("/api/web/bot/start")
    async def bot_start(request: Request):
        require_backend()
        if not settings.auth_enabled or settings.login_method != "bot":
            raise HTTPException(404)
        await auth.limit(request.client.host if request.client else "unknown")
        payload = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
        if not isinstance(payload, dict):
            raise HTTPException(400, "Некорректный запрос.")
        plan_id = payload.get("plan_id")
        checkout_method = payload.get("method", "stars")
        if checkout_method not in {"stars", "rub"}:
            raise HTTPException(400, "Способ оплаты недоступен.")
        if plan_id is not None:
            if not isinstance(plan_id, str) or plan_id not in {p["id"] for p in await repository.catalog()}:
                raise HTTPException(400, "Тариф недоступен.")
        flow, binding, code = await auth.start_bot()
        if plan_id:
            import json
            from .auth import digest
            key = "aera-web:bot-flow:" + digest(flow)
            data = json.loads(await auth.redis.get(key))
            data["plan_id"] = plan_id
            data["checkout_method"] = checkout_method
            await auth.redis.set(key, json.dumps(data), keepttl=True, xx=True)
        response = JSONResponse({"deep_link": "tg://resolve?domain=" + settings.bot_username + "&start=web_" + flow,
                                 "fallback": "https://t.me/" + settings.bot_username + "?start=web_" + flow,
                                 "code": code, "expires_in": 300})
        for name, value in (("aera-bot-request", flow), ("aera-bot-binding", binding)):
            response.set_cookie(name, value, max_age=300, httponly=True, secure=settings.secure, samesite="lax", path="/api/web/bot")
        return response

    @app.post("/api/web/bot/status")
    async def bot_status(request: Request):
        require_backend()
        if settings.login_method != "bot":
            raise HTTPException(404)
        identity = await auth.finish_bot(request.cookies.get("aera-bot-request"), request.cookies.get("aera-bot-binding"))
        if identity is None:
            return {"status": "pending"}
        user_id = await repository.find_user(identity)
        if not user_id:
            raise HTTPException(401, "Профиль AERA недоступен. Откройте бота.")
        await auth.logout(request.cookies.get(settings.cookie))
        response = JSONResponse({"status": "approved"})
        response.set_cookie(settings.cookie, await auth.session(user_id), max_age=43200, httponly=True, secure=settings.secure, samesite="lax", path="/")
        for name in ("aera-bot-request", "aera-bot-binding"):
            response.delete_cookie(name, path="/api/web/bot", secure=settings.secure, httponly=True, samesite="lax")
        return response

    @app.post("/api/web/checkout-summary")
    @app.post("/api/web/checkout")
    async def direct_checkout(request: Request):
        require_backend()
        import os, json, time, hmac, hashlib, httpx, ipaddress
        await auth.limit(request.client.host if request.client else "unknown")
        payload = await request.json()
        if not isinstance(payload, dict):
            raise HTTPException(400)
        identity = await auth.user_id(request.cookies.get(settings.cookie))
        if not identity and not payload.get("intent"):
            raise HTTPException(401, "Войдите через Telegram один раз, чтобы покупка появилась в вашем аккаунте.")
        data = {k: payload.get(k) for k in ("intent", "plan_id", "method", "email", "accepted")}
        data["user_id"] = identity
        if request.url.path == "/api/web/checkout-summary":
            data["action"] = "summary"
        peer = request.client.host if request.client else ""
        # Uvicorn receives the peer supplied by the local trusted nginx proxy.
        try: ipaddress.ip_address(peer)
        except ValueError: raise HTTPException(400)
        data["peer_ip"] = peer
        raw = json.dumps(data, separators=(",", ":")).encode()
        stamp = str(int(time.time()))
        secret = os.environ["AERA_CHECKOUT_BRIDGE_KEY"].encode()
        signature = hmac.new(secret, stamp.encode() + b"." + raw, hashlib.sha256).hexdigest()
        async with httpx.AsyncClient(timeout=50) as client:
            result = await client.post("http://127.0.0.1:8000/internal/web-checkout", content=raw,
                                       headers={"Content-Type": "application/json", "X-Aera-Time": stamp, "X-Aera-Sign": signature})
        if result.status_code != 200:
            try: detail = result.json().get("detail", "Не удалось открыть оплату.")
            except ValueError: detail = "Не удалось открыть оплату."
            raise HTTPException(result.status_code, detail)
        return result.json()

    @app.get("/checkout")
    async def checkout_page():
        return FileResponse(STATIC / "checkout.html")

    @app.get("/healthz")
    async def health():
        return {"status": "ok", "backend_enabled": settings.backend_enabled, "sales_enabled": False}

    @app.get("/robots.txt")
    async def robots():
        # Staging and draft documents must not be indexed.
        return PlainTextResponse("User-agent: *\nDisallow: /\n")

    app.mount("/assets", StaticFiles(directory=STATIC), name="assets")

    @app.get("/{path:path}")
    async def page(path: str):
        return FileResponse(STATIC / "index.html", status_code=200 if "/" + path in PAGES else 404)

    return app


app = create_app()
