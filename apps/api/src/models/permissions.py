from __future__ import annotations
from typing import Optional

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base
from src.models.base import TimestampMixin, uuid_pk


class GranteeType(str, enum.Enum):
    USER = "user"
    GROUP = "group"


class ProjectPermission(str, enum.Enum):
    VIEW = "view"
    EDIT_TASKS = "edit_tasks"
    MANAGE_MEMBERS = "manage_members"
    MANAGE_SETTINGS = "manage_settings"


class ProjectPermissionGrant(Base, TimestampMixin):
    __tablename__ = "project_permission_grants"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    grantee_type: Mapped[GranteeType] = mapped_column(
        Enum(GranteeType, name="grantee_type", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    grantee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    permissions: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    granted_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
