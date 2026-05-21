from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from src.schemas.common import TimestampSchema


class ChatMessageCreate(BaseModel):
    content: str = Field(min_length=1)
    project_id: UUID | None = None


class ChatMessageResponse(TimestampSchema):
    id: UUID
    content: str
    project_id: UUID | None
    sender_id: UUID | None
    organization_id: UUID


class NotificationCreate(BaseModel):
    user_id: UUID
    title: str = Field(min_length=1)
    message: str = Field(min_length=1)
    entity_type: str | None = None
    entity_id: str | None = None


class NotificationResponse(TimestampSchema):
    id: UUID
    user_id: UUID
    title: str
    message: str
    entity_type: str | None
    entity_id: str | None
    is_read: bool
    organization_id: UUID
