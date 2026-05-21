from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class IDResponse(BaseSchema):
    id: UUID


class MessageResponse(BaseModel):
    message: str


class TimestampSchema(BaseSchema):
    created_at: datetime
    updated_at: datetime
