from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from src.schemas.common import TimestampSchema


class TimeEntryCreate(BaseModel):
    project_id: UUID
    task_id: UUID | None = None
    started_at: datetime
    ended_at: datetime | None = None
    note: str | None = None
    source: str = "manual"


class TimeEntryStop(BaseModel):
    ended_at: datetime


class TimeEntryResponse(TimestampSchema):
    id: UUID
    project_id: UUID
    task_id: UUID | None
    user_id: UUID
    started_at: datetime
    ended_at: datetime | None
    duration_minutes: int
    note: str | None
    source: str
    organization_id: UUID
