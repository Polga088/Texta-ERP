from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user
from src.models.crm import Contact
from src.models.organization import User
from src.schemas.crm import ContactCreate, ContactResponse

router = APIRouter()


@router.get("", response_model=list[ContactResponse])
async def list_contacts(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Contact).where(Contact.organization_id == user.organization_id)
    )
    return result.scalars().all()


@router.post("", response_model=ContactResponse, status_code=201)
async def create_contact(
    data: ContactCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    contact = Contact(organization_id=user.organization_id, **data.model_dump())
    db.add(contact)
    await db.flush()
    return contact
