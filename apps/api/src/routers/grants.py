from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user, get_permission_engine
from src.models.organization import User
from src.models.permissions import ProjectPermissionGrant
from src.modules.permissions.engine import PermissionEngine
from src.schemas.permissions import EffectivePermissionsResponse, GrantCreate, GrantResponse
from src.services.audit import log_audit

router = APIRouter()


@router.get("/{project_id}/grants", response_model=list[GrantResponse])
async def list_grants(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
):
    if not await engine.has_project_permission(project_id, "view"):
        raise HTTPException(status_code=403, detail="Permission insuffisante")
    result = await db.execute(
        select(ProjectPermissionGrant).where(ProjectPermissionGrant.project_id == project_id)
    )
    return result.scalars().all()


@router.get("/{project_id}/permissions/effective", response_model=EffectivePermissionsResponse)
async def effective_permissions(
    project_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
):
    perms = await engine.get_effective_permissions(project_id)
    return EffectivePermissionsResponse(
        project_id=project_id, user_id=user.id, permissions=sorted(perms)
    )


@router.post("/{project_id}/grants", response_model=GrantResponse, status_code=status.HTTP_201_CREATED)
async def create_grant(
    project_id: UUID,
    data: GrantCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
):
    if not await engine.can_manage_grants(project_id):
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas gérer les habilitations")
    grant = ProjectPermissionGrant(
        organization_id=user.organization_id,
        project_id=project_id,
        grantee_type=data.grantee_type,
        grantee_id=data.grantee_id,
        permissions=[p.value for p in data.permissions],
        granted_by_id=user.id,
        expires_at=data.expires_at,
    )
    db.add(grant)
    await db.flush()
    await log_audit(
        db,
        organization_id=user.organization_id,
        actor_id=user.id,
        action="grant.create",
        resource_type="project_grant",
        resource_id=str(grant.id),
        details={"project_id": str(project_id), "permissions": grant.permissions},
    )
    return grant


@router.delete("/{project_id}/grants/{grant_id}")
async def delete_grant(
    project_id: UUID,
    grant_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
):
    if not await engine.can_manage_grants(project_id):
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas gérer les habilitations")
    grant = await db.get(ProjectPermissionGrant, grant_id)
    if not grant or grant.project_id != project_id:
        raise HTTPException(status_code=404, detail="Habilitation introuvable")
    await db.delete(grant)
    await log_audit(
        db,
        organization_id=user.organization_id,
        actor_id=user.id,
        action="grant.revoke",
        resource_type="project_grant",
        resource_id=str(grant_id),
    )
    return {"message": "Habilitation révoquée"}
