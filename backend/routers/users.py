from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from database import get_db
from models.auth import UserProfile
from services.auth_service import decode_token

router = APIRouter(prefix='/users', tags=['users'])
bearer = HTTPBearer(auto_error=False)

SESSION_COOKIE = '__xhunt_session'


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None
    default_surface: str | None = None


def _get_user_id(request: Request, credentials: HTTPAuthorizationCredentials | None) -> str:
    token = credentials.credentials if credentials else request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail='Invalid token')
    return payload['sub']


@router.patch('/me', response_model=UserProfile)
async def update_me(
    body: UpdateProfileRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    user_id = _get_user_id(request, credentials)
    db = get_db()

    updates: dict = {}
    if body.display_name is not None:
        updates['display_name'] = body.display_name
    if body.avatar_url is not None:
        updates['avatar_url'] = body.avatar_url
    if body.default_surface in ('home', 'workspace', 'admin'):
        updates['default_surface'] = body.default_surface

    if updates:
        db.table('user_profiles').update(updates).eq('id', user_id).execute()

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


@router.post('/me/complete-onboarding', response_model=UserProfile)
async def complete_onboarding(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    user_id = _get_user_id(request, credentials)
    db = get_db()

    db.table('user_profiles').update({'onboarding_complete': True}).eq('id', user_id).execute()

    result = db.table('user_profiles').select(
        'id, email, display_name, avatar_url, role, default_surface, onboarding_complete, tenant_id'
    ).eq('id', user_id).execute()

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
