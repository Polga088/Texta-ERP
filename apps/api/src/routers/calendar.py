from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.database import get_db
from src.core.deps import get_current_user, get_permission_engine
from src.models.calendar import CalendarEvent, EventAttendee
from src.models.organization import User
from src.modules.permissions.engine import PermissionEngine
from src.schemas.calendar import EventCreate, EventResponse, EventUpdate

router = APIRouter()


def _event_to_response(event: CalendarEvent) -> EventResponse:
    return EventResponse(
        id=event.id,
        title=event.title,
        description=event.description,
        location=event.location,
        meeting_url=event.meeting_url,
        start_at=event.start_at,
        end_at=event.end_at,
        project_id=event.project_id,
        organizer_id=event.organizer_id,
        organization_id=event.organization_id,
        created_at=event.created_at,
        updated_at=event.updated_at,
        attendees=[
            {"id": a.id, "user_id": a.user_id, "response_status": a.response_status}
            for a in event.attendees
        ],
    )


@router.get("/events", response_model=list[EventResponse])
async def list_events(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project_id: UUID | None = None,
):
    stmt = (
        select(CalendarEvent)
        .options(selectinload(CalendarEvent.attendees))
        .where(CalendarEvent.organization_id == user.organization_id)
    )
    if project_id:
        stmt = stmt.where(CalendarEvent.project_id == project_id)
    stmt = stmt.order_by(CalendarEvent.start_at)
    result = await db.execute(stmt)
    return [_event_to_response(e) for e in result.scalars().all()]


@router.post("/events", response_model=EventResponse, status_code=201)
async def create_event(
    data: EventCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    engine: Annotated[PermissionEngine, Depends(get_permission_engine)],
):
    if data.project_id and not await engine.has_project_permission(data.project_id, "view"):
        raise HTTPException(status_code=403, detail="Permission insuffisante")
    event = CalendarEvent(
        organization_id=user.organization_id,
        organizer_id=user.id,
        title=data.title,
        description=data.description,
        location=data.location,
        meeting_url=data.meeting_url,
        start_at=data.start_at,
        end_at=data.end_at,
        project_id=data.project_id,
    )
    db.add(event)
    await db.flush()
    attendee_ids = set(data.attendee_ids) | {user.id}
    for uid in attendee_ids:
        db.add(EventAttendee(event_id=event.id, user_id=uid))
    await db.flush()
    await db.refresh(event, ["attendees"])
    return _event_to_response(event)


@router.patch("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: UUID,
    data: EventUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(CalendarEvent)
        .options(selectinload(CalendarEvent.attendees))
        .where(CalendarEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event or event.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    for field, value in data.model_dump(exclude_unset=True, exclude={"attendee_ids"}).items():
        setattr(event, field, value)
    if data.attendee_ids is not None:
        for a in list(event.attendees):
            await db.delete(a)
        for uid in set(data.attendee_ids) | {user.id}:
            db.add(EventAttendee(event_id=event.id, user_id=uid))
    await db.flush()
    await db.refresh(event, ["attendees"])
    return _event_to_response(event)


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    event = await db.get(CalendarEvent, event_id)
    if not event or event.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    await db.delete(event)
    return {"message": "Événement supprimé"}
