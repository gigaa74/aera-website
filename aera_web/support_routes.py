import os
import re
from fastapi import HTTPException, Request
from starlette.concurrency import run_in_threadpool
from .support import SupportStore


def install_support(app, settings, repository, auth):
    store = SupportStore(os.getenv('AERA_WEB_SUPPORT_DB','/var/lib/aera-web/support.sqlite3'))
    admin_ids = {int(x) for x in os.getenv('AERA_WEB_ADMIN_IDS','').split(',') if x.strip().isdigit()}

    async def is_admin(request):
        if not auth or not repository:
            return False
        identity = await auth.user_id(request.cookies.get(settings.cookie))
        return bool(identity and await repository.support_admin(identity, admin_ids))

    async def payload(request):
        raw = await request.body()
        if len(raw)>12000:
            raise HTTPException(413,'Сообщение слишком длинное.')
        try:
            import json
            data = json.loads(raw)
        except (ValueError,UnicodeError):
            raise HTTPException(400,'Некорректный запрос.') from None
        if not isinstance(data,dict):
            raise HTTPException(400)
        if auth:
            await auth.limit('support:'+ (request.client.host if request.client else 'unknown'))
        return data

    def body(data):
        value=data.get('message','')
        if not isinstance(value,str) or not 3<=len(value.strip())<=4000:
            raise HTTPException(400,'Напишите сообщение от 3 до 4000 символов.')
        return value.strip()

    def reference(data):
        identity,token=data.get('id',''),data.get('token','')
        if not isinstance(identity,str) or not re.fullmatch(r'[0-9a-f]{24}',identity) or not isinstance(token,str) or len(token)>100:
            raise HTTPException(400)
        return identity,token

    @app.get('/api/web/support/access')
    async def access(request:Request):
        return {'admin':await is_admin(request)}

    @app.post('/api/web/support/create')
    async def create(request:Request):
        data=await payload(request)
        if data.get('website'):
            raise HTTPException(400)
        contact=data.get('contact','')
        if not isinstance(contact,str) or len(contact)>150:
            raise HTTPException(400,'Контакт слишком длинный.')
        if data.get('accepted') is not True:
            raise HTTPException(400,'Ознакомьтесь с политикой конфиденциальности.')
        if auth:
            peer=request.client.host if request.client else 'unknown'
            from hashlib import sha256
            import time
            key='aera-support:create:'+sha256(peer.encode()).hexdigest()+':'+str(int(time.time())//3600)
            count=await auth.redis.incr(key)
            if count==1:await auth.redis.expire(key,3601)
            if count>5:raise HTTPException(429,'Слишком много обращений. Продолжите существующее обращение или попробуйте позже.')
        owner=await auth.user_id(request.cookies.get(settings.cookie)) if auth else None
        return await run_in_threadpool(store.create,body(data),contact.strip(),owner)

    @app.post('/api/web/support/view')
    async def view(request:Request):
        data=await payload(request);identity,token=reference(data)
        result=await run_in_threadpool(store.thread,identity,token,await is_admin(request))
        if not result:raise HTTPException(404,'Обращение не найдено или ссылка доступа неверна.')
        return result

    @app.post('/api/web/support/reply')
    async def reply(request:Request):
        data=await payload(request);identity,token=reference(data)
        ok=await run_in_threadpool(store.reply,identity,body(data),token,await is_admin(request))
        if not ok:raise HTTPException(404)
        return {'ok':True}

    @app.get('/api/web/support/admin')
    async def listing(request:Request):
        if not await is_admin(request):raise HTTPException(403,'Войдите в аккаунт администратора AERA.')
        return {'tickets':await run_in_threadpool(store.listing)}

    @app.post('/api/web/support/close')
    async def close(request:Request):
        if not await is_admin(request):raise HTTPException(403)
        data=await payload(request);identity,_=reference(data)
        if not await run_in_threadpool(store.close,identity):raise HTTPException(404)
        return {'ok':True}
