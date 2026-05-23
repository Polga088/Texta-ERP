from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user, get_permission_engine
from src.models.crm import Project
from src.models.organization import GlobalRole, User
from src.modules.permissions.engine import PermissionEngine
from src.schemas.crm import ProjectCreate, ProjectDeleteRequest, ProjectResponse, ProjectUpdate
from src.services.audit import log_audit

router = APIRouter()


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
):
    result = await db.execute(
        select(Project).where(Project.organization_id == user.organization_id).order_by(Project.name)
    )
    projects = result.scalars().all()
    visible = []
    for p in projects:
        if await engine.has_project_permission(p.id, "view"):
            visible.append(p)
    return visible


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = Project(
        organization_id=user.organization_id,
        owner_id=data.owner_id or user.id,
        **data.model_dump(exclude={"owner_id"}),
    )
    db.add(project)
    await db.flush()
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
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
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
