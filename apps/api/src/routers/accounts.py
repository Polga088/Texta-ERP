from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user
from src.models.crm import Account
from src.models.organization import User
from src.schemas.crm import AccountCreate, AccountResponse

router = APIRouter()


@router.get("", response_model=list[AccountResponse])
async def list_accounts(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Account).where(Account.organization_id == user.organization_id).order_by(Account.name)
    )
    return result.scalars().all()


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(
    data: AccountCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    account = Account(organization_id=user.organization_id, **data.model_dump())
    db.add(account)
    await db.flush()
    return account


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    account = await db.get(Account, account_id)
    if not account or account.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    return account
