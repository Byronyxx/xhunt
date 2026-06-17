import uuid
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Response, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import get_db
from models.auth import RegisterRequest, LoginRequest, TokenResponse, UserProfile, AuthResponse
from services.auth_service import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_token,
)
from config import settings

router = APIRouter(prefix='/auth', tags=['auth'])
bearer = HTTPBearer(auto_error=False)

REFRESH_COOKIE = '__xhunt_refresh'
SESSION_COOKIE = '__xhunt_session'

COOKIE_OPTS = dict(
    httponly=True,
    secure=settings.app_env != 'development',
    samesite='lax',
    path='/',
)


def _set_cookies(response: Response, user_id: str, email: str, role: str, surface: str):
    access_token, expires_in = create_access_token(user_id, email, role, surface)
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(
        SESSION_COOKIE, access_token,
        max_age=expires_in,
        **COOKIE_OPTS,
    )
    response.set_cookie(
        REFRESH_COOKIE, refresh_token,
        max_age=settings.refresh_token_expire_days * 86400,
        **COOKIE_OPTS,
    )
    return access_token, expires_in


@router.post('/register', response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest, response: Response):
    db = get_db()

    # Check email uniqueness
    existing = db.table('user_profiles').select('id').eq('email', body.email).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail='Email already registered')

    user_id = str(uuid.uuid4())
    password_hash = hash_password(body.password)
    display_name = body.display_name or body.email.split('@')[0]

    result = db.table('user_profiles').insert({
        'id': user_id,
        'email': body.email,
        'password_hash': password_hash,
        'display_name': display_name,
        'role': 'explorer',
        'default_surface': 'home',
        'onboarding_complete': False,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail='Failed to create account')

    profile = result.data[0]
    access_token, expires_in = _set_cookies(response, user_id, body.email, 'explorer', 'home')

    return AuthResponse(
        token=TokenResponse(access_token=access_token, expires_in=expires_in),
        user=UserProfile(
            id=user_id,
            email=body.email,
            display_name=display_name,
            avatar_url=None,
            role='explorer',
            default_surface='home',
            onboarding_complete=False,
            tenant_id=None,
        ),
    )


@router.post('/login', response_model=AuthResponse)
async def login(body: LoginRequest, response: Response):
    db = get_db()

    result = db.table('user_profiles').select(
        'id, email, password_hash, display_name, avatar_url, role, default_surface, onboarding_complete, tenant_id'
    ).eq('email', body.email).execute()

    if not result.data:
        raise HTTPException(status_code=401, detail='Invalid email or password')

    profile = result.data[0]

    if not profile.get('password_hash'):
        raise HTTPException(status_code=401, detail='Invalid email or password')

    if not verify_password(body.password, profile['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid email or password')

    surface = profile.get('default_surface') or 'home'
    access_token, expires_in = _set_cookies(
        response, profile['id'], profile['email'], profile['role'], surface
    )

    return AuthResponse(
        token=TokenResponse(access_token=access_token, expires_in=expires_in),
        user=UserProfile(
            id=profile['id'],
            email=profile['email'],
            display_name=profile.get('display_name'),
            avatar_url=profile.get('avatar_url'),
            role=profile['role'],
            default_surface=surface,
            onboarding_complete=bool(profile.get('onboarding_complete')),
            tenant_id=profile.get('tenant_id'),
        ),
    )


@router.post('/refresh', response_model=TokenResponse)
async def refresh(request: Request, response: Response):
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail='No refresh token')

    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail='Invalid refresh token')

    if payload.get('type') != 'refresh':
        raise HTTPException(status_code=401, detail='Invalid token type')

    user_id = payload['sub']
    db = get_db()
    result = db.table('user_profiles').select(
        'email, role, default_surface'
    ).eq('id', user_id).execute()

    if not result.data:
        raise HTTPException(status_code=401, detail='User not found')

    p = result.data[0]
    access_token, expires_in = _set_cookies(response, user_id, p['email'], p['role'], p.get('default_surface', 'home'))

    return TokenResponse(access_token=access_token, expires_in=expires_in)


@router.post('/logout')
async def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE, path='/')
    response.delete_cookie(REFRESH_COOKIE, path='/')
    return {'ok': True}


@router.get('/me', response_model=UserProfile)
async def me(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    # Accept Bearer header or session cookie
    token = None
    if credentials:
        token = credentials.credentials
    else:
        token = request.cookies.get(SESSION_COOKIE)

    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')

    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail='Invalid token')

    if payload.get('type') != 'access':
        raise HTTPException(status_code=401, detail='Invalid token type')

    user_id = payload['sub']
    db = get_db()
    result = db.table('user_profiles').select(
        'id, email, display_name, avatar_url, role, default_surface, onboarding_complete, tenant_id'
    ).eq('id', user_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail='User not found')

    p = result.data[0]
    return UserProfile(
        id=p['id'],
        email=p['email'],
        display_name=p.get('display_name'),
        avatar_url=p.get('avatar_url'),
        role=p['role'],
        default_surface=p.get('default_surface', 'home'),
        onboarding_complete=bool(p.get('onboarding_complete')),
        tenant_id=p.get('tenant_id'),
    )
