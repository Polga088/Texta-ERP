from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from src.models.document import DocumentEntityType
from src.schemas.common import TimestampSchema


class DocumentResponse(TimestampSchema):
    id: UUID
    entity_type: DocumentEntityType
    entity_id: UUID
    original_filename: str
    stored_filename: str
    file_path: str
    mime_type: str | None
    file_size: int
    organization_id: UUID
    uploaded_by_id: UUID | None
    uploaded_by_name: str | None = None
