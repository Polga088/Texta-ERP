from __future__ import annotations
from typing import Optional

import enum
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base
from src.models.base import TimestampMixin, uuid_pk


class ProjectStatus(str, enum.Enum):
    LEAD = "lead"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Account(Base, TimestampMixin):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    contacts: Mapped[list["Contact"]] = relationship(back_populates="account", cascade="all, delete-orphan")
    projects: Mapped[list["Project"]] = relationship(back_populates="account")


class Contact(Base, TimestampMixin):
    __tablename__ = "contacts"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    account: Mapped["Account | None"] = relationship(back_populates="contacts")


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus, name="project_status", values_callable=lambda x: [e.value for e in x]),
        default=ProjectStatus.LEAD,
        nullable=False,
    )
    budget: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company_logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    project_code: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    quality_standard: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    scope_statement: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    iso_context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    iso_risk_register: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    iso_objectives: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    iso_kpis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    iso_acceptance_criteria: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    iso_document_control: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    iso_change_control: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    account: Mapped["Account | None"] = relationship(back_populates="projects")


class LeadStatus(str, enum.Enum):
    NEW = "new"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    WON = "won"
    LOST = "lost"


class LeadCurrency(str, enum.Enum):
    MAD = "MAD"
    EUR = "EUR"
    USD = "USD"


class LeadPriority(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class LeadNextActionType(str, enum.Enum):
    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    QUOTE = "quote"
    FOLLOW_UP = "follow_up"
    NONE = "none"


class LeadLostReason(str, enum.Enum):
    PRICE = "price_too_high"
    TIMING = "wrong_timing"
    COMPETITOR = "competitor"
    BUDGET = "no_budget"
    INTERNAL = "internal_decision"
    OTHER = "other"


class Lead(Base, TimestampMixin):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company_website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    contact_job_title: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    status: Mapped[LeadStatus] = mapped_column(
        Enum(LeadStatus, name="lead_status", values_callable=lambda x: [e.value for e in x]),
        default=LeadStatus.NEW,
        nullable=False,
    )
    deal_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    currency: Mapped[LeadCurrency] = mapped_column(
        Enum(LeadCurrency, name="lead_currency", values_callable=lambda x: [e.value for e in x]),
        default=LeadCurrency.MAD,
        nullable=False,
    )
    product_service: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    estimated_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    expected_close_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    conversion_probability: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    priority: Mapped[LeadPriority] = mapped_column(
        Enum(LeadPriority, name="lead_priority", values_callable=lambda x: [e.value for e in x]),
        default=LeadPriority.MEDIUM,
        nullable=False,
    )
    marketing_campaign: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    last_activity: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    next_action_type: Mapped[LeadNextActionType] = mapped_column(
        Enum(LeadNextActionType, name="lead_next_action_type", values_callable=lambda x: [e.value for e in x]),
        default=LeadNextActionType.NONE,
        nullable=False,
    )
    next_action_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    next_action_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    attachments: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    lost_reason: Mapped[Optional[LeadLostReason]] = mapped_column(
        Enum(LeadLostReason, name="lead_lost_reason", values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )
    lost_competitor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
