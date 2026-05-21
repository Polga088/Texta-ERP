from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user, require_global_role
from src.models.collaboration import ChatMessage, Notification
from src.models.organization import GlobalRole, User
from src.schemas.collaboration import (
    ChatMessageCreate,
    ChatMessageResponse,
    NotificationCreate,
    NotificationResponse,
)

router = APIRouter()


@router.get("/messages", response_model=list[ChatMessageResponse])
async def list_messages(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project_id: UUID | None = None,
):
    stmt = select(ChatMessage).where(ChatMessage.organization_id == user.organization_id)
    if project_id:
        stmt = stmt.where(ChatMessage.project_id == project_id)
    stmt = stmt.order_by(ChatMessage.created_at.desc()).limit(100)
    result = await db.execute(stmt)
    return list(reversed(result.scalars().all()))


@router.post("/messages", response_model=ChatMessageResponse, status_code=201)
async def post_message(
    data: ChatMessageCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    msg = ChatMessage(
        organization_id=user.organization_id,
        sender_id=user.id,
        project_id=data.project_id,
        content=data.content,
    )
    db.add(msg)
    await db.flush()
    return msg


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Notification)
        .where(Notification.organization_id == user.organization_id, Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
    )
    return result.scalars().all()


@router.post("/notifications", response_model=NotificationResponse, status_code=201)
async def create_notification(
    data: NotificationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_global_role(GlobalRole.ADMIN, GlobalRole.PROJECT_MANAGER))],
):
    notif = Notification(organization_id=actor.organization_id, **data.model_dump())
    db.add(notif)
    await db.flush()
    return notif


@router.patch("/notifications/{notification_id}/read")
async def mark_read(
    notification_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    notif = await db.get(Notification, notification_id)
    if not notif or notif.organization_id != user.organization_id or notif.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    notif.is_read = True
    await db.flush()
    return {"message": "Notification lue"}
