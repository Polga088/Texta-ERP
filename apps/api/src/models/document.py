from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base
from src.models.base import OrgScopedMixin, TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from src.models.organization import User


class DocumentEntityType(str, enum.Enum):
    LEAD = "lead"
    PROJECT = "project"
    TASK = "task"
    QUOTE = "quote"
    INVOICE = "invoice"
    CLIENT = "client"


class Document(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = uuid_pk()
    entity_type: Mapped[DocumentEntityType] = mapped_column(
        Enum(
            DocumentEntityType,
            name="document_entity_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(150), nullable=True)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    uploaded_by: Mapped["User | None"] = relationship()
