from pydantic import BaseModel, EmailStr, field_validator
import re


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    expires_in: int


class UserProfile(BaseModel):
    id: str
    email: str
    display_name: str | None
    avatar_url: str | None
    role: str
    default_surface: str
    onboarding_complete: bool
    tenant_id: str | None


class AuthResponse(BaseModel):
    token: TokenResponse
    user: UserProfile


class RefreshRequest(BaseModel):
    refresh_token: str | None = None
