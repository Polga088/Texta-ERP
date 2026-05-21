from __future__ import annotations

from datetime import timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user
from src.models.organization import User
from src.models.time_tracking import TimeEntry
from src.schemas.time_tracking import TimeEntryCreate, TimeEntryResponse, TimeEntryStop

router = APIRouter()


def _minutes(started_at, ended_at) -> int:
    if not ended_at:
        return 0
    delta = ended_at - started_at
    return max(int(delta.total_seconds() // 60), 0)


@router.get("", response_model=list[TimeEntryResponse])
async def list_time_entries(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project_id: UUID | None = None,
):
    stmt = select(TimeEntry).where(TimeEntry.organization_id == user.organization_id)
    if project_id:
        stmt = stmt.where(TimeEntry.project_id == project_id)
    stmt = stmt.order_by(TimeEntry.created_at.desc()).limit(200)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=TimeEntryResponse, status_code=201)
async def create_time_entry(
    data: TimeEntryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    duration = _minutes(data.started_at, data.ended_at)
    entry = TimeEntry(
        organization_id=user.organization_id,
        user_id=user.id,
        duration_minutes=duration,
        **data.model_dump(),
    )
    db.add(entry)
    await db.flush()
    return entry


@router.patch("/{entry_id}/stop", response_model=TimeEntryResponse)
async def stop_time_entry(
    entry_id: UUID,
    data: TimeEntryStop,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    entry = await db.get(TimeEntry, entry_id)
    if not entry or entry.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Entrée de temps introuvable")
    if entry.ended_at:
        return entry
    entry.ended_at = data.ended_at.astimezone(timezone.utc)
    entry.duration_minutes = _minutes(entry.started_at, entry.ended_at)
    await db.flush()
    return entry
