from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from src.schemas.common import BaseSchema, TimestampSchema


class EventCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    location: str | None = None
    meeting_url: str | None = None
    start_at: datetime
    end_at: datetime
    project_id: UUID | None = None
    attendee_ids: list[UUID] = []


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    location: str | None = None
    meeting_url: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    project_id: UUID | None = None
    attendee_ids: list[UUID] | None = None


class AttendeeResponse(BaseSchema):
    id: UUID
    user_id: UUID
    response_status: str


class EventResponse(TimestampSchema):
    id: UUID
    title: str
    description: str | None
    location: str | None
    meeting_url: str | None
    start_at: datetime
    end_at: datetime
    project_id: UUID | None
    organizer_id: UUID | None
    organization_id: UUID
    attendees: list[AttendeeResponse] = []
