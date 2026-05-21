from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from src.schemas.common import BaseSchema


class AuditLogResponse(BaseSchema):
    id: UUID
    actor_id: UUID | None
    action: str
    resource_type: str
    resource_id: str | None
    details: dict | None
    created_at: datetime
