from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from src.models.crm import ProjectStatus
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


class ProjectUpdate(BaseModel):
    name: str | None = None
    account_id: UUID | None = None
    description: str | None = None
    status: ProjectStatus | None = None
    budget: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    owner_id: UUID | None = None


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
