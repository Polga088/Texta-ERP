from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user, get_permission_engine
from src.models.crm import Project
from src.models.organization import User
from src.models.task import Task, TaskStatus
from src.models.time_tracking import TimeEntry
from src.modules.permissions.engine import PermissionEngine
from src.schemas.task import (
    TaskCommentCreate,
    TaskCreate,
    TaskKpis,
    TaskResponse,
    TaskTimeLogCreate,
    TaskUpdate,
)

router = APIRouter()


def _sync_task_progress(task: Task, subtasks: list[Task]) -> None:
    if subtasks:
        done = len([child for child in subtasks if child.status == TaskStatus.DONE])
        task.completion_percentage = round((done / len(subtasks)) * 100)
    elif task.checklist:
        done = len([item for item in task.checklist if item.get("completed")])
        task.completion_percentage = round((done / len(task.checklist)) * 100)
    else:
        if task.status == TaskStatus.TODO:
            task.completion_percentage = 0
        elif task.status in {TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.BLOCKED}:
            task.completion_percentage = max(task.completion_percentage, 50)
        elif task.status == TaskStatus.DONE:
            task.completion_percentage = 100


async def _sync_task_hours(db: AsyncSession, task: Task) -> None:
    result = await db.execute(
        select(func.coalesce(func.sum(TimeEntry.duration_minutes), 0)).where(TimeEntry.task_id == task.id)
    )
    minutes = int(result.scalar_one() or 0)
    task.actual_hours = round(minutes / 60, 2)


async def _ensure_status_transition_allowed(
    db: AsyncSession, task: Task, user: User, requested_status: TaskStatus | None, data: TaskUpdate
) -> None:
    if not requested_status or requested_status == task.status:
        return

    if task.status == TaskStatus.DONE and user.global_role != "admin":
        raise HTTPException(status_code=400, detail="Tâche terminée verrouillée")

    if requested_status == TaskStatus.BLOCKED and not data.block_reason:
        raise HTTPException(status_code=400, detail="Raison de blocage obligatoire")
    if task.status == TaskStatus.BLOCKED and requested_status != TaskStatus.BLOCKED and not data.unblock_note:
        raise HTTPException(status_code=400, detail="Note de déblocage obligatoire")

    project = await db.get(Project, task.project_id) if task.project_id else None
    is_admin = user.global_role == "admin"
    is_pm = project and project.project_manager_id == user.id
    is_assignee = task.assignee_id == user.id
    if not (is_admin or is_pm or is_assignee):
        raise HTTPException(status_code=403, detail="Seul PM, assigné ou admin peut changer le statut")

    if requested_status == TaskStatus.DONE:
        children_result = await db.execute(select(Task).where(Task.parent_id == task.id))
        children = children_result.scalars().all()
        if any(child.status != TaskStatus.DONE for child in children):
            raise HTTPException(status_code=400, detail="Terminez d'abord les sous-tâches")


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
    project_id: UUID | None = None,
    assignee_id: UUID | None = None,
    status: TaskStatus | None = None,
    q: str | None = Query(default=None, min_length=1),
    priority: str | None = None,
    category: str | None = None,
    tag: str | None = None,
    mine: bool = False,
):
    stmt = select(Task).where(Task.organization_id == user.organization_id)
    if project_id:
        if not await engine.has_project_permission(project_id, "view"):
            raise HTTPException(status_code=403, detail="Permission insuffisante")
        stmt = stmt.where(Task.project_id == project_id)
    if assignee_id:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    if mine:
        stmt = stmt.where(Task.assignee_id == user.id)
    if status:
        stmt = stmt.where(Task.status == status)
    if priority:
        stmt = stmt.where(Task.priority == priority)
    if category:
        stmt = stmt.where(Task.category == category)
    if q:
        query = f"%{q.strip()}%"
        stmt = stmt.where(Task.title.ilike(query) | Task.description.ilike(query))
    stmt = stmt.order_by(Task.position, Task.created_at.desc())
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    if tag:
        tasks = [task for task in tasks if tag in (task.tags or [])]
    if not project_id:
        filtered = []
        for t in tasks:
            if t.project_id is None or await engine.has_project_permission(t.project_id, "view"):
                filtered.append(t)
        return filtered
    return tasks


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    data: TaskCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
):
    if not await engine.has_project_permission(data.project_id, "edit_tasks"):
        raise HTTPException(status_code=403, detail="Permission insuffisante")
    project = await db.get(Project, data.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    task_code = data.task_code or f"TSK-{(project.project_code or 'XXXX')[-4:]}-{uuid4().hex[:3].upper()}"
    task = Task(
        organization_id=user.organization_id,
        created_by_id=user.id,
        assignee_id=data.assignee_id or user.id,
        task_code=task_code,
        hourly_rate=data.hourly_rate if data.hourly_rate is not None else project.hourly_rate,
        **data.model_dump(exclude={"task_code"}),
    )
    if task.start_date and task.due_date:
        task.duration_days = max((task.due_date - task.start_date).days, 0)
    db.add(task)
    await db.flush()
    _sync_task_progress(task, [])
    return task


@router.get("/kpis", response_model=TaskKpis)
async def task_kpis(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
    project_id: UUID,
):
    if not await engine.has_project_permission(project_id, "view"):
        raise HTTPException(status_code=403, detail="Permission insuffisante")
    result = await db.execute(
        select(Task).where(Task.organization_id == user.organization_id, Task.project_id == project_id)
    )
    tasks = result.scalars().all()
    estimated = sum([float(t.estimated_hours or 0) for t in tasks])
    actual = sum([float(t.actual_hours or 0) for t in tasks])
    variance = round(((actual - estimated) / estimated) * 100, 2) if estimated else 0.0
    return TaskKpis(
        total=len(tasks),
        todo=len([t for t in tasks if t.status == TaskStatus.TODO]),
        in_progress=len([t for t in tasks if t.status == TaskStatus.IN_PROGRESS]),
        done=len([t for t in tasks if t.status == TaskStatus.DONE]),
        blocked=len([t for t in tasks if t.status == TaskStatus.BLOCKED]),
        estimated_hours=round(estimated, 2),
        actual_hours=round(actual, 2),
        variance_percent=variance,
    )


@router.get("/export")
async def export_tasks_csv(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
    project_id: UUID,
):
    if not await engine.has_project_permission(project_id, "view"):
        raise HTTPException(status_code=403, detail="Permission insuffisante")
    result = await db.execute(
        select(Task).where(Task.organization_id == user.organization_id, Task.project_id == project_id)
    )
    tasks = result.scalars().all()
    headers = ["code", "name", "status", "priority", "assignee", "due_date", "estimated_hours", "actual_hours"]
    rows = [",".join(headers)]

    def esc(value: str | None) -> str:
        safe = (value or "").replace('"', '""')
        return f'"{safe}"'

    for t in tasks:
        rows.append(
            ",".join(
                [
                    esc(t.task_code),
                    esc(t.title),
                    esc(t.status.value if t.status else ""),
                    esc(t.priority.value if t.priority else ""),
                    str(t.assignee_id or ""),
                    str(t.due_date or ""),
                    str(t.estimated_hours or 0),
                    str(t.actual_hours or 0),
                ]
            )
        )
    return Response(
        content="\n".join(rows),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tasks_export.csv"},
    )


@router.post("/{task_id}/comments", response_model=TaskResponse)
async def add_task_comment(
    task_id: UUID,
    data: TaskCommentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    task = await db.get(Task, task_id)
    if not task or task.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    task.comments = [
        *(task.comments or []),
        {
            "author_id": str(user.id),
            "author_name": user.full_name,
            "content": data.content,
            "attachments": data.attachments,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]
    await db.flush()
    return task


@router.post("/{task_id}/time-logs", response_model=TaskResponse)
async def add_task_time_log(
    task_id: UUID,
    data: TaskTimeLogCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    task = await db.get(Task, task_id)
    if not task or task.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    if not task.project_id:
        raise HTTPException(status_code=400, detail="Tâche sans projet parent")
    started_at = datetime.combine(data.date, datetime.min.time(), tzinfo=timezone.utc)
    ended_at = started_at + timedelta(minutes=int(data.hours * 60))
    entry = TimeEntry(
        organization_id=user.organization_id,
        project_id=task.project_id,
        task_id=task.id,
        user_id=user.id,
        started_at=started_at,
        ended_at=ended_at,
        duration_minutes=int(data.hours * 60),
        note=data.description,
        source="manual",
    )
    db.add(entry)
    await _sync_task_hours(db, task)
    await db.flush()
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    data: TaskUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
):
    task = await db.get(Task, task_id)
    if not task or task.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    if task.project_id and not await engine.has_project_permission(task.project_id, "edit_tasks"):
        raise HTTPException(status_code=403, detail="Permission insuffisante")
    await _ensure_status_transition_allowed(db, task, user, data.status, data)

    if task.status in {TaskStatus.DONE} and user.global_role != "admin":
        raise HTTPException(status_code=400, detail="Tâche terminée en lecture seule")

    previous_status = task.status
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    if data.status and data.status != previous_status:
        if data.status == TaskStatus.IN_PROGRESS and not task.actual_start_date:
            task.actual_start_date = date.today()
        if data.status == TaskStatus.DONE and not task.actual_end_date:
            task.actual_end_date = date.today()
        if data.status == TaskStatus.BLOCKED:
            task.blocked_since = datetime.now(timezone.utc)
            task.blocked_by = user.id
        if previous_status == TaskStatus.BLOCKED and data.status != TaskStatus.BLOCKED:
            task.unblocked_at = datetime.now(timezone.utc)

    if task.start_date and task.due_date:
        task.duration_days = max((task.due_date - task.start_date).days, 0)
    if task.actual_end_date and task.due_date and task.actual_end_date > task.due_date:
        task.delay_days = (task.actual_end_date - task.due_date).days
    elif task.due_date and task.status != TaskStatus.DONE and date.today() > task.due_date:
        task.delay_days = (date.today() - task.due_date).days
    else:
        task.delay_days = 0

    children_result = await db.execute(select(Task).where(Task.parent_id == task.id))
    children = children_result.scalars().all()
    _sync_task_progress(task, children)
    await _sync_task_hours(db, task)
    await db.flush()
    return task


@router.delete("/{task_id}")
async def delete_task(
    task_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
):
    task = await db.get(Task, task_id)
    if not task or task.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    if task.project_id and not await engine.has_project_permission(task.project_id, "edit_tasks"):
        raise HTTPException(status_code=403, detail="Permission insuffisante")
    await db.delete(task)
    return {"message": "Tâche supprimée"}
