from __future__ import annotations

from datetime import date
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user, get_permission_engine
from src.models.crm import Project, ProjectHealthStatus, ProjectStatus
from src.models.organization import GlobalRole, User
from src.models.task import Task, TaskStatus
from src.models.time_tracking import TimeEntry
from src.modules.permissions.engine import PermissionEngine
from src.schemas.crm import ProjectCreate, ProjectDeleteRequest, ProjectResponse, ProjectUpdate
from src.services.audit import log_audit

router = APIRouter()

READONLY_STATUSES = {ProjectStatus.DONE, ProjectStatus.CANCELLED, ProjectStatus.COMPLETED}


async def _recalculate_project_metrics(db: AsyncSession, project: Project) -> None:
    if project.start_date and project.end_date:
        project.duration_days = max((project.end_date - project.start_date).days, 0)

    total_minutes_result = await db.execute(
        select(func.coalesce(func.sum(TimeEntry.duration_minutes), 0)).where(TimeEntry.project_id == project.id)
    )
    total_minutes = int(total_minutes_result.scalar_one() or 0)
    consumed = (total_minutes / 60) * float(project.hourly_rate or 0)

    project.budget_consumed = round(consumed, 2)
    total_budget = float(project.budget or 0)
    project.budget_remaining = round(total_budget - consumed, 2)

    tasks_result = await db.execute(select(Task).where(Task.project_id == project.id))
    tasks = tasks_result.scalars().all()
    if tasks:
        done = len([t for t in tasks if t.status == TaskStatus.DONE])
        blocked = len([t for t in tasks if t.status == TaskStatus.IN_REVIEW and t.due_date and t.due_date < date.today()])
        project.completion_percentage = round((done / len(tasks)) * 100)
    else:
        blocked = 0
        project.completion_percentage = 0

    delay_days = 0
    if project.actual_end_date and project.end_date and project.actual_end_date > project.end_date:
        delay_days = (project.actual_end_date - project.end_date).days
    elif project.end_date and project.status in {ProjectStatus.IN_PROGRESS, ProjectStatus.ACTIVE} and date.today() > project.end_date:
        delay_days = (date.today() - project.end_date).days
    project.delay_days = delay_days

    if delay_days > 3 or (total_budget > 0 and consumed > total_budget * 0.95) or blocked > 0:
        project.health_status = ProjectHealthStatus.DANGER
    elif delay_days > 0 or (total_budget > 0 and consumed > total_budget * 0.8):
        project.health_status = ProjectHealthStatus.WATCH
    elif project.completion_percentage >= 0:
        project.health_status = ProjectHealthStatus.GOOD
    else:
        project.health_status = ProjectHealthStatus.NOT_EVALUATED


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
):
    result = await db.execute(
        select(Project).where(Project.organization_id == user.organization_id).order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    return [p for p in projects if await engine.has_project_permission(p.id, "view")]


@router.get("/kpis")
async def project_kpis(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Project).where(Project.organization_id == user.organization_id))
    projects = result.scalars().all()
    total = len(projects) or 1
    active = [p for p in projects if p.status in {ProjectStatus.IN_PROGRESS, ProjectStatus.ACTIVE}]
    completed = [p for p in projects if p.status in {ProjectStatus.DONE, ProjectStatus.COMPLETED}]
    delayed = [p for p in projects if (p.delay_days or 0) > 0]
    paused = [p for p in projects if p.status == ProjectStatus.ON_HOLD]
    risk = [p for p in projects if p.health_status == ProjectHealthStatus.DANGER]
    budget_total = sum(float(p.budget or 0) for p in projects)
    budget_consumed = sum(float(p.budget_consumed or 0) for p in projects)
    completion_avg = round(sum(p.completion_percentage for p in projects) / total, 2)

    hours_result = await db.execute(
        select(func.coalesce(func.sum(TimeEntry.duration_minutes), 0)).where(
            TimeEntry.organization_id == user.organization_id
        )
    )
    hours_month = round((hours_result.scalar_one() or 0) / 60, 2)

    return {
        "active_count": len(active),
        "completed_count": len(completed),
        "completed_percent": round((len(completed) / total) * 100, 2),
        "delayed_count": len(delayed),
        "paused_count": len(paused),
        "completion_avg": completion_avg,
        "budget_consumed_percent": round((budget_consumed / budget_total) * 100, 2) if budget_total else 0,
        "hours_month": hours_month,
        "risk_count": len(risk),
    }


@router.get("/export")
async def export_projects_csv(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Project).where(Project.organization_id == user.organization_id))
    projects = result.scalars().all()
    headers = ["code", "name", "status", "priority", "start_date", "end_date", "completion", "budget", "health"]
    rows = [",".join(headers)]

    def esc(value: str | None) -> str:
        safe = (value or "").replace('"', '""')
        return f'"{safe}"'

    for p in projects:
        rows.append(
            ",".join(
                [
                    esc(p.project_code),
                    esc(p.name),
                    esc(p.status.value if p.status else ""),
                    esc(p.priority.value if p.priority else ""),
                    str(p.start_date or ""),
                    str(p.end_date or ""),
                    str(p.completion_percentage),
                    str(p.budget or ""),
                    esc(p.health_status.value if p.health_status else ""),
                ]
            )
        )
    return Response(
        content="\n".join(rows),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=projects_export.csv"},
    )


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    generated_code = f"PRJ-{date.today().year}-{uuid4().hex[:4].upper()}"
    project = Project(
        organization_id=user.organization_id,
        owner_id=data.owner_id or user.id,
        project_manager_id=data.project_manager_id or data.owner_id or user.id,
        project_code=data.project_code or generated_code,
        **data.model_dump(exclude={"owner_id", "project_manager_id", "project_code"}),
    )
    if project.status in {ProjectStatus.IN_PROGRESS, ProjectStatus.ACTIVE} and not project.actual_start_date:
        project.actual_start_date = date.today()
    db.add(project)
    await db.flush()
    await _recalculate_project_metrics(db, project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
):
    if not await engine.has_project_permission(project_id, "view"):
        raise HTTPException(status_code=403, detail="Permission insuffisante")
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
):
    if not await engine.has_project_permission(project_id, "manage_settings"):
        raise HTTPException(status_code=403, detail="Permission insuffisante")
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    if project.status in READONLY_STATUSES and data.status not in {project.status, None}:
        raise HTTPException(status_code=400, detail="Projet en lecture seule (terminé/annulé)")

    incoming_status = data.status
    if incoming_status == ProjectStatus.ON_HOLD and not data.pause_reason:
        raise HTTPException(status_code=400, detail="Raison de pause obligatoire")
    if incoming_status == ProjectStatus.CANCELLED and not data.cancel_reason:
        raise HTTPException(status_code=400, detail="Raison d'annulation obligatoire")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    if incoming_status in {ProjectStatus.IN_PROGRESS, ProjectStatus.ACTIVE} and not project.actual_start_date:
        project.actual_start_date = date.today()
    if incoming_status in {ProjectStatus.DONE, ProjectStatus.COMPLETED} and not project.actual_end_date:
        project.actual_end_date = date.today()

    await _recalculate_project_metrics(db, project)
    await db.flush()
    return project


@router.delete("/{project_id}")
async def delete_project(
    project_id: UUID,
    data: ProjectDeleteRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = await db.get(Project, project_id)
    if not project or project.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    if user.global_role not in {GlobalRole.ADMIN, GlobalRole.PROJECT_MANAGER}:
        raise HTTPException(status_code=403, detail="Suppression réservée à l'admin ou au chef de projet")

    await log_audit(
        db,
        organization_id=user.organization_id,
        actor_id=user.id,
        action="project.delete",
        resource_type="project",
        resource_id=str(project.id),
        details={"reason": data.reason, "project_name": project.name},
    )
    await db.delete(project)
    return {"message": "Projet supprimé"}
