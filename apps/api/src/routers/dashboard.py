from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user
from src.models.calendar import CalendarEvent
from src.models.crm import Account, Project, ProjectStatus
from src.models.hr import Employee, LeaveRequest, LeaveStatus
from src.models.organization import User
from src.models.task import Task, TaskStatus
from src.schemas.dashboard import DashboardStats

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    org_id = user.organization_id
    now = datetime.now(timezone.utc)
    week_end = now + timedelta(days=7)

    projects_total = await db.scalar(
        select(func.count()).select_from(Project).where(Project.organization_id == org_id)
    )
    projects_active = await db.scalar(
        select(func.count())
        .select_from(Project)
        .where(Project.organization_id == org_id, Project.status == ProjectStatus.ACTIVE)
    )
    tasks_total = await db.scalar(
        select(func.count()).select_from(Task).where(Task.organization_id == org_id)
    )
    tasks_done = await db.scalar(
        select(func.count())
        .select_from(Task)
        .where(Task.organization_id == org_id, Task.status == TaskStatus.DONE)
    )
    employees_total = await db.scalar(
        select(func.count()).select_from(Employee).where(Employee.organization_id == org_id)
    )
    leave_pending = await db.scalar(
        select(func.count())
        .select_from(LeaveRequest)
        .where(
            LeaveRequest.organization_id == org_id,
            LeaveRequest.status == LeaveStatus.SUBMITTED,
        )
    )
    events_this_week = await db.scalar(
        select(func.count())
        .select_from(CalendarEvent)
        .where(
            CalendarEvent.organization_id == org_id,
            CalendarEvent.start_at >= now,
            CalendarEvent.start_at <= week_end,
        )
    )
    accounts_total = await db.scalar(
        select(func.count()).select_from(Account).where(Account.organization_id == org_id)
    )

    return DashboardStats(
        projects_total=projects_total or 0,
        projects_active=projects_active or 0,
        tasks_total=tasks_total or 0,
        tasks_done=tasks_done or 0,
        employees_total=employees_total or 0,
        leave_pending=leave_pending or 0,
        events_this_week=events_this_week or 0,
        accounts_total=accounts_total or 0,
    )
