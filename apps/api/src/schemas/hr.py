from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from src.models.hr import EmploymentStatus, LeaveStatus
from src.schemas.common import BaseSchema, TimestampSchema


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1)
    parent_id: UUID | None = None


class DepartmentResponse(TimestampSchema):
    id: UUID
    name: str
    parent_id: UUID | None
    organization_id: UUID


class EmployeeCreate(BaseModel):
    user_id: UUID | None = None
    department_id: UUID | None = None
    manager_id: UUID | None = None
    employee_number: str
    job_title: str
    hire_date: date
    contract_type: str | None = None


class EmployeeResponse(TimestampSchema):
    id: UUID
    user_id: UUID | None
    department_id: UUID | None
    manager_id: UUID | None
    employee_number: str
    job_title: str
    hire_date: date
    contract_type: str | None
    status: EmploymentStatus
    organization_id: UUID


class LeaveRequestCreate(BaseModel):
    employee_id: UUID
    leave_type: str
    start_date: date
    end_date: date
    reason: str | None = None


class LeaveRequestUpdate(BaseModel):
    status: LeaveStatus | None = None
    reason: str | None = None


class LeaveRequestResponse(TimestampSchema):
    id: UUID
    employee_id: UUID
    leave_type: str
    start_date: date
    end_date: date
    reason: str | None
    status: LeaveStatus
    reviewed_by_id: UUID | None
    organization_id: UUID
