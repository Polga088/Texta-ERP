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
    ProjectHealthStatus,
    ProjectPriority,
    ProjectStatus,
    ProjectType,
    ProjectVisibility,
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
    client_lead_id: UUID | None = None
    description: str | None = None
    project_type: ProjectType = ProjectType.INTERNAL
    category: str | None = None
    status: ProjectStatus = ProjectStatus.DRAFT
    budget: Decimal | None = None
    budget_alert_threshold: int = Field(default=80, ge=50, le=95)
    currency: str = "MAD"
    hourly_rate: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    project_manager_id: UUID | None = None
    team_members: list[dict] = Field(default_factory=list)
    priority: ProjectPriority = ProjectPriority.MEDIUM
    tags: list[str] = Field(default_factory=list)
    visibility: ProjectVisibility = ProjectVisibility.PRIVATE
    deliverables: list[dict] = Field(default_factory=list)
    project_documents: list[str] = Field(default_factory=list)
    notes: str | None = None
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
    iso_document_control: bool = True
    iso_change_control: bool = True


class ProjectUpdate(BaseModel):
    name: str | None = None
    account_id: UUID | None = None
    client_lead_id: UUID | None = None
    description: str | None = None
    project_type: ProjectType | None = None
    category: str | None = None
    status: ProjectStatus | None = None
    budget: Decimal | None = None
    budget_alert_threshold: int | None = Field(default=None, ge=50, le=95)
    currency: str | None = None
    hourly_rate: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    project_manager_id: UUID | None = None
    team_members: list[dict] | None = None
    priority: ProjectPriority | None = None
    tags: list[str] | None = None
    visibility: ProjectVisibility | None = None
    deliverables: list[dict] | None = None
    project_documents: list[str] | None = None
    notes: str | None = None
    pause_reason: str | None = None
    cancel_reason: str | None = None
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
    project_type: ProjectType
    category: str | None
    status: ProjectStatus
    client_lead_id: UUID | None
    budget: Decimal | None
    budget_consumed: Decimal
    budget_remaining: Decimal
    budget_alert_threshold: int
    currency: str
    hourly_rate: Decimal | None
    start_date: date | None
    end_date: date | None
    actual_start_date: date | None
    actual_end_date: date | None
    duration_days: int | None
    delay_days: int | None
    account_id: UUID | None
    owner_id: UUID | None
    project_manager_id: UUID | None
    team_members: list[dict]
    priority: ProjectPriority
    tags: list[str]
    visibility: ProjectVisibility
    deliverables: list[dict]
    project_documents: list[str]
    notes: str | None
    completion_percentage: int
    health_status: ProjectHealthStatus
    pause_reason: str | None
    cancel_reason: str | None
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
