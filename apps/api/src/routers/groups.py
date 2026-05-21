from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.database import get_db
from src.core.deps import get_current_user, require_global_role
from src.models.organization import GlobalRole, Group, GroupMember, User
from src.schemas.organization import GroupCreate, GroupMemberAdd, GroupResponse
from src.services.audit import log_audit

router = APIRouter()


@router.get("", response_model=list[GroupResponse])
async def list_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Group, func.count(GroupMember.id))
        .outerjoin(GroupMember, GroupMember.group_id == Group.id)
        .where(Group.organization_id == user.organization_id)
        .group_by(Group.id)
    )
    groups = []
    for group, count in result.all():
        groups.append(
            GroupResponse(
                id=group.id,
                name=group.name,
                description=group.description,
                organization_id=group.organization_id,
                member_count=count,
                created_at=group.created_at,
                updated_at=group.updated_at,
            )
        )
    return groups


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    data: GroupCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_global_role(GlobalRole.ADMIN, GlobalRole.PROJECT_MANAGER))],
):
    group = Group(
        organization_id=user.organization_id,
        name=data.name,
        description=data.description,
    )
    db.add(group)
    await db.flush()
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        organization_id=group.organization_id,
        member_count=0,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    group_id: UUID,
    data: GroupMemberAdd,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_global_role(GlobalRole.ADMIN, GlobalRole.PROJECT_MANAGER))],
):
    group = await db.get(Group, group_id)
    if not group or group.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Groupe introuvable")
    member = GroupMember(group_id=group_id, user_id=data.user_id)
    db.add(member)
    await db.flush()
    await log_audit(
        db,
        organization_id=user.organization_id,
        actor_id=user.id,
        action="group.member.add",
        resource_type="group",
        resource_id=str(group_id),
        details={"user_id": str(data.user_id)},
    )
    return {"message": "Membre ajouté"}


@router.delete("/{group_id}/members/{member_user_id}")
async def remove_member(
    group_id: UUID,
    member_user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_global_role(GlobalRole.ADMIN, GlobalRole.PROJECT_MANAGER))],
):
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id, GroupMember.user_id == member_user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    await db.delete(member)
    return {"message": "Membre retiré"}
