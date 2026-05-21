from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from src.models.permissions import GranteeType, ProjectPermission
from src.schemas.common import BaseSchema, TimestampSchema


class GrantCreate(BaseModel):
    grantee_type: GranteeType
    grantee_id: UUID
    permissions: list[ProjectPermission] = Field(min_length=1)
    expires_at: datetime | None = None


class GrantResponse(TimestampSchema):
    id: UUID
    project_id: UUID
    grantee_type: GranteeType
    grantee_id: UUID
    permissions: list[str]
    granted_by_id: UUID | None
    expires_at: datetime | None


class EffectivePermissionsResponse(BaseModel):
    project_id: UUID
    user_id: UUID
    permissions: list[str]
