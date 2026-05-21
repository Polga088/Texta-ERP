from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user, require_global_role
from src.core.security import get_password_hash
from src.models.organization import GlobalRole, User
from src.schemas.auth import UserCreate, UserResponse, UserUpdate
from src.services.audit import log_audit

router = APIRouter()


@router.get("", response_model=list[UserResponse])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(User).where(User.organization_id == user.organization_id).order_by(User.full_name)
    )
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_global_role(GlobalRole.ADMIN))],
):
    existing = await db.execute(
        select(User).where(User.email == data.email.lower(), User.organization_id == admin.organization_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    new_user = User(
        organization_id=admin.organization_id,
        email=data.email.lower(),
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        global_role=data.global_role,
    )
    db.add(new_user)
    await db.flush()
    await log_audit(
        db,
        organization_id=admin.organization_id,
        actor_id=admin.id,
        action="user.create",
        resource_type="user",
        resource_id=str(new_user.id),
    )
    return new_user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_global_role(GlobalRole.ADMIN))],
):
    target = await db.get(User, user_id)
    if not target or target.organization_id != admin.organization_id:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(target, field, value)
    await db.flush()
    return target
