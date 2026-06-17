from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import auth, users

app = FastAPI(
    title='X-Hunt Auth Service',
    version='1.0.0',
    docs_url='/docs' if settings.app_env != 'production' else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth.router)
app.include_router(users.router)


@app.get('/health')
async def health():
    return {'status': 'ok'}
