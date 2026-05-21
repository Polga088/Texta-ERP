from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user
from src.models.crm import Lead
from src.models.organization import User
from src.schemas.crm import LeadCreate, LeadResponse, LeadUpdate

router = APIRouter()


@router.get("", response_model=list[LeadResponse])
async def list_leads(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Lead).where(Lead.organization_id == user.organization_id).order_by(Lead.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=LeadResponse, status_code=201)
async def create_lead(
    data: LeadCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    lead = Lead(
        organization_id=user.organization_id,
        owner_id=data.owner_id or user.id,
        **data.model_dump(exclude={"owner_id"}),
    )
    db.add(lead)
    await db.flush()
    return lead


@router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: UUID,
    data: LeadUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    lead = await db.get(Lead, lead_id)
    if not lead or lead.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Lead introuvable")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    await db.flush()
    return lead
