from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user, require_global_role
from src.models.audit import AuditLog
from src.models.organization import GlobalRole, User
from src.schemas.audit import AuditLogResponse

router = APIRouter()


@router.get("/logs", response_model=list[AuditLogResponse])
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_global_role(GlobalRole.ADMIN))],
    limit: int = 100,
):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.organization_id == admin.organization_id)
        .order_by(AuditLog.created_at.desc())
        .limit(min(limit, 500))
    )
    return result.scalars().all()
