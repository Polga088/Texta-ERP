from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from src.models.organization import GlobalRole
from src.schemas.common import BaseSchema, TimestampSchema


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2)
    organization_name: str = Field(min_length=2)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(TimestampSchema):
    id: UUID
    email: str
    full_name: str
    global_role: GlobalRole
    is_active: bool
    organization_id: UUID
    avatar_url: str | None = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    global_role: GlobalRole = GlobalRole.MEMBER


class UserUpdate(BaseModel):
    full_name: str | None = None
    global_role: GlobalRole | None = None
    is_active: bool | None = None
