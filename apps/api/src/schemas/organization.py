from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from src.schemas.common import BaseSchema, TimestampSchema


class OrganizationResponse(TimestampSchema):
    id: UUID
    name: str
    slug: str


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class GroupResponse(TimestampSchema):
    id: UUID
    name: str
    description: str | None
    organization_id: UUID
    member_count: int = 0


class GroupMemberAdd(BaseModel):
    user_id: UUID
