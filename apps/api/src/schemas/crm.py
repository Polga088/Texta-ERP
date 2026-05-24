from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from src.models.crm import (
    LeadCurrency,
    LeadLostReason,
    LeadNextActionType,
    LeadPriority,
    LeadStatus,
    ProjectStatus,
)
from src.schemas.common import BaseSchema, TimestampSchema


class AccountCreate(BaseModel):
    name: str = Field(min_length=1)
    industry: str | None = None
    website: str | None = None
    notes: str | None = None


class AccountResponse(TimestampSchema):
    id: UUID
    name: str
    industry: str | None
    website: str | None
    notes: str | None
    organization_id: UUID


class ContactCreate(BaseModel):
    full_name: str
    account_id: UUID | None = None
    email: str | None = None
    phone: str | None = None
    job_title: str | None = None


class ContactResponse(TimestampSchema):
    id: UUID
    full_name: str
    account_id: UUID | None
    email: str | None
    phone: str | None
    job_title: str | None
    organization_id: UUID


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1)
    account_id: UUID | None = None
    description: str | None = None
    status: ProjectStatus = ProjectStatus.LEAD
    budget: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    owner_id: UUID | None = None
    company_name: str | None = None
    company_logo_url: str | None = None
    project_code: str | None = None
    scope_statement: str = Field(min_length=20)
    iso_context: str = Field(min_length=20)
    iso_risk_register: str = Field(min_length=20)
    iso_objectives: str = Field(min_length=20)
    iso_kpis: str = Field(min_length=20)
    iso_acceptance_criteria: str = Field(min_length=20)
    iso_document_control: bool = True
    iso_change_control: bool = True


class ProjectUpdate(BaseModel):
    name: str | None = None
    account_id: UUID | None = None
    description: str | None = None
    status: ProjectStatus | None = None
    budget: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    owner_id: UUID | None = None
    company_name: str | None = None
    company_logo_url: str | None = None
    project_code: str | None = None
    scope_statement: str | None = None
    iso_context: str | None = None
    iso_risk_register: str | None = None
    iso_objectives: str | None = None
    iso_kpis: str | None = None
    iso_acceptance_criteria: str | None = None
    iso_document_control: bool | None = None
    iso_change_control: bool | None = None


class ProjectDeleteRequest(BaseModel):
    reason: str = Field(min_length=10, max_length=1000)


class ProjectResponse(TimestampSchema):
    id: UUID
    name: str
    description: str | None
    status: ProjectStatus
    budget: Decimal | None
    start_date: date | None
    end_date: date | None
    account_id: UUID | None
    owner_id: UUID | None
    organization_id: UUID
    company_name: str | None
    company_logo_url: str | None
    project_code: str | None
    scope_statement: str | None
    iso_context: str | None
    iso_risk_register: str | None
    iso_objectives: str | None
    iso_kpis: str | None
    iso_acceptance_criteria: str | None
    iso_document_control: bool
    iso_change_control: bool


class LeadCreate(BaseModel):
    title: str = Field(min_length=1)
    contact_name: str = Field(min_length=1)
    contact_email: str = Field(min_length=3)
    contact_phone: str | None = None
    company_name: str | None = None
    company_website: str | None = None
    contact_job_title: str | None = None
    source: str | None = None
    status: LeadStatus = LeadStatus.NEW
    deal_value: Decimal = Field(gt=0)
    currency: LeadCurrency = LeadCurrency.MAD
    product_service: str = Field(min_length=1)
    estimated_value: Decimal | None = None
    expected_close_date: date
    conversion_probability: int = Field(default=20, ge=0, le=100)
    priority: LeadPriority = LeadPriority.MEDIUM
    marketing_campaign: str | None = None
    owner_id: UUID | None = None
    assigned_to: UUID | None = None
    next_action_type: LeadNextActionType = LeadNextActionType.NONE
    next_action_date: date | None = None
    next_action_note: str | None = None
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    attachments: list[str] = Field(default_factory=list)
    lost_reason: LeadLostReason | None = None
    lost_competitor: str | None = None
    account_id: UUID | None = None
    contact_id: UUID | None = None
    notes: str | None = None

    @field_validator("contact_email")
    @classmethod
    def validate_email_shape(cls, value: str) -> str:
        if "@" not in value:
            raise ValueError("Email invalide")
        return value.lower().strip()


class LeadUpdate(BaseModel):
    title: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    company_name: str | None = None
    company_website: str | None = None
    contact_job_title: str | None = None
    source: str | None = None
    status: LeadStatus | None = None
    deal_value: Decimal | None = None
    currency: LeadCurrency | None = None
    product_service: str | None = None
    estimated_value: Decimal | None = None
    expected_close_date: date | None = None
    conversion_probability: int | None = Field(default=None, ge=0, le=100)
    priority: LeadPriority | None = None
    marketing_campaign: str | None = None
    owner_id: UUID | None = None
    assigned_to: UUID | None = None
    next_action_type: LeadNextActionType | None = None
    next_action_date: date | None = None
    next_action_note: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    attachments: list[str] | None = None
    lost_reason: LeadLostReason | None = None
    lost_competitor: str | None = None
    account_id: UUID | None = None
    contact_id: UUID | None = None
    notes: str | None = None


class LeadResponse(TimestampSchema):
    id: UUID
    title: str
    contact_name: str | None
    contact_email: str | None
    contact_phone: str | None
    company_name: str | None
    company_website: str | None
    contact_job_title: str | None
    source: str | None
    status: LeadStatus
    deal_value: Decimal | None
    currency: LeadCurrency
    product_service: str | None
    estimated_value: Decimal | None
    expected_close_date: date | None
    conversion_probability: int | None
    priority: LeadPriority
    marketing_campaign: str | None
    owner_id: UUID | None
    assigned_to: UUID | None
    last_activity: datetime | None
    next_action_type: LeadNextActionType
    next_action_date: date | None
    next_action_note: str | None
    description: str | None
    tags: list[str]
    attachments: list[str]
    lost_reason: LeadLostReason | None
    lost_competitor: str | None
    account_id: UUID | None
    contact_id: UUID | None
    notes: str | None
    organization_id: UUID
