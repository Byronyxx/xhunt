from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt, JWTError
from passlib.context import CryptContext

from config import settings

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _make_token(payload: dict[str, Any], expire_delta: timedelta) -> str:
    exp = datetime.now(timezone.utc) + expire_delta
    return jwt.encode(
        {**payload, 'exp': exp, 'iat': datetime.now(timezone.utc)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def create_access_token(user_id: str, email: str, role: str, surface: str) -> tuple[str, int]:
    expires = timedelta(minutes=settings.access_token_expire_minutes)
    token = _make_token(
        {'sub': user_id, 'email': email, 'role': role, 'surface': surface, 'type': 'access'},
        expires,
    )
    return token, settings.access_token_expire_minutes * 60


def create_refresh_token(user_id: str) -> str:
    expires = timedelta(days=settings.refresh_token_expire_days)
    return _make_token({'sub': user_id, 'type': 'refresh'}, expires)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise ValueError(f'Invalid token: {e}') from e
