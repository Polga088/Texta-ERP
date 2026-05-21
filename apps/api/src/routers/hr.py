from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user, require_global_role
from src.models.hr import Department, Employee, LeaveRequest, LeaveStatus
from src.models.organization import GlobalRole, User
from src.schemas.hr import (
    DepartmentCreate,
    DepartmentResponse,
    EmployeeCreate,
    EmployeeResponse,
    LeaveRequestCreate,
    LeaveRequestResponse,
    LeaveRequestUpdate,
)

router = APIRouter()


@router.get("/departments", response_model=list[DepartmentResponse])
async def list_departments(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Department).where(Department.organization_id == user.organization_id)
    )
    return result.scalars().all()


@router.post("/departments", response_model=DepartmentResponse, status_code=201)
async def create_department(
    data: DepartmentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_global_role(GlobalRole.ADMIN, GlobalRole.HR_MANAGER))],
):
    dept = Department(organization_id=user.organization_id, **data.model_dump())
    db.add(dept)
    await db.flush()
    return dept


@router.get("/employees", response_model=list[EmployeeResponse])
async def list_employees(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Employee).where(Employee.organization_id == user.organization_id)
    )
    return result.scalars().all()


@router.post("/employees", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    data: EmployeeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_global_role(GlobalRole.ADMIN, GlobalRole.HR_MANAGER))],
):
    emp = Employee(organization_id=user.organization_id, **data.model_dump())
    db.add(emp)
    await db.flush()
    return emp


@router.get("/employees/org-chart")
async def org_chart(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Employee).where(Employee.organization_id == user.organization_id)
    )
    employees = result.scalars().all()
    nodes = [
        {
            "id": str(e.id),
            "employee_number": e.employee_number,
            "job_title": e.job_title,
            "manager_id": str(e.manager_id) if e.manager_id else None,
            "department_id": str(e.department_id) if e.department_id else None,
            "user_id": str(e.user_id) if e.user_id else None,
        }
        for e in employees
    ]
    return {"nodes": nodes}


@router.get("/leave-requests", response_model=list[LeaveRequestResponse])
async def list_leave_requests(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(LeaveRequest).where(LeaveRequest.organization_id == user.organization_id)
    )
    return result.scalars().all()


@router.post("/leave-requests", response_model=LeaveRequestResponse, status_code=201)
async def create_leave_request(
    data: LeaveRequestCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    leave = LeaveRequest(organization_id=user.organization_id, **data.model_dump())
    db.add(leave)
    await db.flush()
    return leave


@router.patch("/leave-requests/{leave_id}", response_model=LeaveRequestResponse)
async def update_leave_request(
    leave_id: UUID,
    data: LeaveRequestUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_global_role(GlobalRole.ADMIN, GlobalRole.HR_MANAGER))],
):
    leave = await db.get(LeaveRequest, leave_id)
    if not leave or leave.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(leave, field, value)
    if data.status in (LeaveStatus.APPROVED, LeaveStatus.REJECTED):
        leave.reviewed_by_id = user.id
    await db.flush()
    return leave
