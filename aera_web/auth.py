"""Telegram OIDC authorization code + PKCE; opaque Redis sessions."""
import base64
import hashlib
import hmac
import secrets
import time
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool

ISSUER = "https://oauth.telegram.org"


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class Auth:
    def __init__(self, settings, redis):
        self.settings, self.redis = settings, redis
        self.keys = jwt.PyJWKClient(ISSUER + "/.well-known/jwks.json", timeout=8)

    async def limit(self, peer):
        key = "aera-web:rate:" + digest(peer) + ":" + str(int(time.time()) // 60)
        count = await self.redis.incr(key)
        if count == 1:
            await self.redis.expire(key, 120)
        if count > 15:
            raise HTTPException(429, "Слишком много попыток. Подождите минуту.")

    async def start(self):
        state, verifier, binding, nonce = (secrets.token_urlsafe(32) for _ in range(4))
        import json
        await self.redis.set("aera-web:flow:" + digest(state), json.dumps({
            "verifier": verifier, "binding": digest(binding), "nonce": nonce,
        }), ex=300, nx=True)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        if self.settings.login_method == "widget":
            return self.settings.origin + "/auth/callback?" + urlencode({"state": state}), binding
        url = ISSUER + "/auth?" + urlencode({
            "client_id": self.settings.oidc_client_id,
            "redirect_uri": self.settings.origin + "/auth/callback",
            "response_type": "code", "scope": "openid profile", "state": state,
            "nonce": nonce, "code_challenge": challenge, "code_challenge_method": "S256",
        })
        return url, binding

    async def finish_widget(self, pairs, binding):
        import json
        values = dict(pairs)
        if len(values) != len(pairs):
            raise HTTPException(400, "Вход не подтверждён.")
        state = values.pop("state", "")
        if not state or len(state) > 128 or not binding:
            raise HTTPException(400, "Вход не подтверждён.")
        record = await self.redis.getdel("aera-web:flow:" + digest(state))
        if not record or not secrets.compare_digest(json.loads(record)["binding"], digest(binding)):
            raise HTTPException(403, "Вход не подтверждён.")
        signature = values.pop("hash", "")
        allowed = {"id", "auth_date", "first_name", "last_name", "username", "photo_url"}
        if not {"id", "auth_date"} <= values.keys() or not values.keys() <= allowed or any(len(v) > 2048 for v in values.values()):
            raise HTTPException(401, "Telegram не подтвердил вход.")
        check = "\n".join(f"{key}={value}" for key, value in sorted(values.items()))
        expected = hmac.new(bytes.fromhex(self.settings.widget_secret), check.encode(), hashlib.sha256).hexdigest()
        if not secrets.compare_digest(expected, signature):
            raise HTTPException(401, "Telegram не подтвердил вход.")
        try:
            identity, issued = int(values["id"]), int(values["auth_date"])
        except ValueError:
            raise HTTPException(401, "Telegram не подтвердил вход.") from None
        if identity <= 0 or not -30 <= time.time() - issued <= 300:
            raise HTTPException(401, "Время входа истекло.")
        if not await self.redis.set("aera-web:widget-used:" + digest(signature), "1", ex=330, nx=True):
            raise HTTPException(401, "Начните вход заново.")
        return identity

    def verify(self, token, nonce):
        key = self.keys.get_signing_key_from_jwt(token)
        claims = jwt.decode(token, key.key, algorithms=["RS256"], audience=self.settings.oidc_client_id,
                            issuer=ISSUER, options={"require": ["exp", "iat", "sub", "iss", "aud", "id", "nonce"]})
        if not secrets.compare_digest(str(claims["nonce"]), nonce):
            raise ValueError("Nonce mismatch")
        identity = claims["id"]
        if isinstance(identity, bool) or not str(identity).isdigit() or int(identity) <= 0:
            raise ValueError("Invalid Telegram identity")
        return int(identity)

    async def finish(self, state, code, binding):
        import json
        if not state or len(state) > 128 or not binding or not code or len(code) > 4096:
            raise HTTPException(400, "Вход не подтверждён. Начните заново.")
        record = await self.redis.getdel("aera-web:flow:" + digest(state))
        if not record:
            raise HTTPException(400, "Время входа истекло. Начните заново.")
        flow = json.loads(record)
        if not secrets.compare_digest(flow["binding"], digest(binding)):
            raise HTTPException(403, "Вход не подтверждён.")
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            response = await client.post(ISSUER + "/token", auth=(self.settings.oidc_client_id, self.settings.oidc_client_secret), data={
                "grant_type": "authorization_code", "code": code,
                "redirect_uri": self.settings.origin + "/auth/callback",
                "client_id": self.settings.oidc_client_id, "code_verifier": flow["verifier"],
            })
        if response.status_code != 200:
            raise HTTPException(401, "Telegram не подтвердил вход.")
        try:
            return await run_in_threadpool(self.verify, response.json()["id_token"], flow["nonce"])
        except (ValueError, KeyError, jwt.PyJWTError):
            raise HTTPException(401, "Telegram не подтвердил вход.") from None

    async def session(self, user_id):
        token = secrets.token_urlsafe(32)
        await self.redis.set("aera-web:session:" + digest(token), user_id, ex=43200)
        return token

    async def start_bot(self):
        import json
        request, binding = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        code = str(secrets.randbelow(1000000)).zfill(6)
        await self.redis.set("aera-web:bot-flow:" + digest(request), json.dumps({
            "binding": digest(binding), "code": code, "status": "pending",
        }), ex=300, nx=True)
        return request, binding, code

    async def finish_bot(self, request, binding):
        import json
        if not request or len(request) > 128 or not binding or len(binding) > 128:
            raise HTTPException(401, "Начните вход заново.")
        key = "aera-web:bot-flow:" + digest(request)
        raw = await self.redis.get(key)
        if not raw:
            raise HTTPException(410, "Время входа истекло.")
        flow = json.loads(raw)
        if not secrets.compare_digest(flow["binding"], digest(binding)):
            raise HTTPException(403, "Вход не подтверждён.")
        if flow["status"] == "pending":
            return None
        if flow["status"] != "approved":
            raise HTTPException(401, "Вход отменён.")
        consumed = await self.redis.getdel(key)
        if not consumed:
            raise HTTPException(410, "Начните вход заново.")
        return int(json.loads(consumed)["telegram_id"])

    async def user_id(self, token):
        if not token or len(token) > 128:
            return None
        value = await self.redis.get("aera-web:session:" + digest(token))
        return value.decode() if isinstance(value, bytes) else value

    async def logout(self, token):
        if token:
            await self.redis.delete("aera-web:session:" + digest(token))
