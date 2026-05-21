from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.security import decode_token
from src.models.organization import GlobalRole, User
from src.models.permissions import ProjectPermission
from src.modules.permissions.engine import PermissionEngine

security = HTTPBearer(auto_error=False)


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Non authentifié")
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")
    result = await db.execute(select(User).where(User.id == UUID(user_id), User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable")
    return user


async def get_permission_engine(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> PermissionEngine:
    return PermissionEngine(db, user)


def require_global_role(*roles: GlobalRole):
    async def checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.global_role not in roles and user.global_role != GlobalRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
        return user

    return checker


def require_project_permission(permission: ProjectPermission):
    async def checker(
        project_id: UUID,
        engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
    ) -> PermissionEngine:
        if not await engine.has_project_permission(project_id, permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission insuffisante")
        return engine

    return checker
