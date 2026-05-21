from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from src.models.crm import LeadStatus, ProjectStatus
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
    quality_standard: str | None = None
    scope_statement: str | None = None


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
    quality_standard: str | None = None
    scope_statement: str | None = None


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
    quality_standard: str | None
    scope_statement: str | None


class LeadCreate(BaseModel):
    title: str = Field(min_length=1)
    source: str | None = None
    status: LeadStatus = LeadStatus.NEW
    estimated_value: Decimal | None = None
    expected_close_date: date | None = None
    owner_id: UUID | None = None
    account_id: UUID | None = None
    contact_id: UUID | None = None
    notes: str | None = None


class LeadUpdate(BaseModel):
    title: str | None = None
    source: str | None = None
    status: LeadStatus | None = None
    estimated_value: Decimal | None = None
    expected_close_date: date | None = None
    owner_id: UUID | None = None
    account_id: UUID | None = None
    contact_id: UUID | None = None
    notes: str | None = None


class LeadResponse(TimestampSchema):
    id: UUID
    title: str
    source: str | None
    status: LeadStatus
    estimated_value: Decimal | None
    expected_close_date: date | None
    owner_id: UUID | None
    account_id: UUID | None
    contact_id: UUID | None
    notes: str | None
    organization_id: UUID
