from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user, get_permission_engine
from src.models.organization import User
from src.models.task import Task, TaskStatus
from src.modules.permissions.engine import PermissionEngine
from src.schemas.task import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter()


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
    project_id: UUID | None = None,
    assignee_id: UUID | None = None,
    status: TaskStatus | None = None,
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
    stmt = stmt.order_by(Task.position, Task.created_at.desc())
    result = await db.execute(stmt)
    tasks = result.scalars().all()
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
    if data.project_id and not await engine.has_project_permission(data.project_id, "edit_tasks"):
        raise HTTPException(status_code=403, detail="Permission insuffisante")
    task = Task(
        organization_id=user.organization_id,
        created_by_id=user.id,
        **data.model_dump(),
    )
    db.add(task)
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
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
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
