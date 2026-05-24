from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user
from src.models.crm import Lead, LeadStatus
from src.models.organization import GlobalRole, User
from src.schemas.crm import LeadCreate, LeadResponse, LeadUpdate

router = APIRouter()


@router.get("", response_model=list[LeadResponse])
async def list_leads(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: LeadStatus | None = None,
    q: str | None = Query(default=None, min_length=1),
):
    stmt = select(Lead).where(Lead.organization_id == user.organization_id)
    if status:
        stmt = stmt.where(Lead.status == status)
    if q:
        query = f"%{q.strip()}%"
        stmt = stmt.where(
            Lead.title.ilike(query)
            | Lead.contact_name.ilike(query)
            | Lead.contact_email.ilike(query)
            | Lead.company_name.ilike(query)
        )
    result = await db.execute(stmt.order_by(Lead.created_at.desc()))
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
        assigned_to=data.assigned_to or data.owner_id or user.id,
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

    requested_status = data.status
    if (
        requested_status
        and requested_status != lead.status
        and lead.status in {LeadStatus.WON, LeadStatus.LOST}
        and user.global_role != GlobalRole.ADMIN
    ):
        raise HTTPException(
            status_code=403,
            detail="Un lead gagné/perdu ne peut être réouvert que par un administrateur",
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    lead.last_activity = func.now()
    await db.flush()
    return lead


@router.delete("/{lead_id}")
async def delete_lead(
    lead_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    lead = await db.get(Lead, lead_id)
    if not lead or lead.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Lead introuvable")
    await db.delete(lead)
    return {"message": "Lead supprimé"}


@router.get("/kpis")
async def lead_kpis(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Lead).where(Lead.organization_id == user.organization_id))
    leads = result.scalars().all()

    new_count = len([l for l in leads if l.status == LeadStatus.NEW])
    pipeline_leads = [l for l in leads if l.status in {LeadStatus.NEW, LeadStatus.QUALIFIED, LeadStatus.PROPOSAL}]
    won_leads = [l for l in leads if l.status == LeadStatus.WON]
    lost_leads = [l for l in leads if l.status == LeadStatus.LOST]
    pipeline_value = float(sum([(l.deal_value or 0) for l in pipeline_leads]))
    won_value = float(sum([(l.deal_value or 0) for l in won_leads]))
    lost_value = float(sum([(l.deal_value or 0) for l in lost_leads]))

    conversion_denominator = max(len(leads), 1)
    conversion_rate = round((len(won_leads) / conversion_denominator) * 100, 2)

    return {
        "new_count": new_count,
        "pipeline_count": len([l for l in leads if l.status in {LeadStatus.QUALIFIED, LeadStatus.PROPOSAL}]),
        "won_count": len(won_leads),
        "lost_count": len(lost_leads),
        "conversion_rate": conversion_rate,
        "pipeline_value": pipeline_value,
        "won_value": won_value,
        "lost_value": lost_value,
    }


@router.get("/export")
async def export_leads_csv(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Lead).where(Lead.organization_id == user.organization_id))
    leads = result.scalars().all()
    headers = [
        "opportunity_name",
        "contact_name",
        "contact_email",
        "company_name",
        "deal_value",
        "currency",
        "status",
        "priority",
        "assigned_to",
        "expected_close_date",
    ]
    def esc(value: str | None) -> str:
        safe = (value or "").replace('"', '""')
        return f'"{safe}"'

    rows = [",".join(headers)]
    for lead in leads:
        rows.append(
            ",".join(
                [
                    esc(lead.title),
                    esc(lead.contact_name),
                    esc(lead.contact_email),
                    esc(lead.company_name),
                    str(lead.deal_value or ""),
                    str(lead.currency.value if lead.currency else ""),
                    str(lead.status.value if lead.status else ""),
                    str(lead.priority.value if lead.priority else ""),
                    str(lead.assigned_to or ""),
                    str(lead.expected_close_date or ""),
                ]
            )
        )

    csv_content = "\n".join(rows)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads_export.csv"},
    )
