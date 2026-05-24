from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user
from src.models.billing import Invoice, InvoiceStatus, Payment, Quote, QuoteStatus
from src.models.crm import Lead, LeadStatus
from src.models.organization import User
from src.schemas.billing import (
    BillingKpis,
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
    PaymentCreate,
    PaymentResponse,
    QuoteCreate,
    QuoteResponse,
    QuoteUpdate,
)

router = APIRouter()


def _build_number(prefix: str, count: int) -> str:
    return f"{prefix}-{date.today().year}-{str(count + 1).zfill(4)}"


def _compute_totals(items: list[dict], tva_rate: float) -> tuple[float, float, float]:
    total_ht = 0.0
    normalized: list[dict] = []
    for item in items:
        qty = float(item.get("qty") or 0)
        unit_price = float(item.get("unit_price") or 0)
        discount = float(item.get("discount_percent") or 0)
        line_total = qty * unit_price * (1 - discount / 100)
        row = {**item, "total_ht": round(line_total, 2)}
        normalized.append(row)
        total_ht += line_total
    tva_amount = total_ht * (tva_rate / 100)
    total_ttc = total_ht + tva_amount
    return round(total_ht, 2), round(tva_amount, 2), round(total_ttc, 2)


def _to_decimal(value: float) -> Decimal:
    return Decimal(str(round(value, 2)))


@router.get("/quotes", response_model=list[QuoteResponse])
async def list_quotes(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Quote).where(Quote.organization_id == user.organization_id).order_by(Quote.created_at.desc())
    )
    return result.scalars().all()


@router.post("/quotes", response_model=QuoteResponse, status_code=201)
async def create_quote(
    data: QuoteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if data.lead_id:
        lead = await db.get(Lead, data.lead_id)
        if not lead or lead.organization_id != user.organization_id:
            raise HTTPException(status_code=404, detail="Lead introuvable")
        if lead.status != LeadStatus.WON:
            raise HTTPException(status_code=400, detail="Le devis doit provenir d'un lead gagné")
    result = await db.execute(select(Quote).where(Quote.organization_id == user.organization_id))
    quote_number = _build_number("DEV", len(result.scalars().all()))
    total_ht, tva_amount, total_ttc = _compute_totals(
        [item.model_dump() if hasattr(item, "model_dump") else item for item in data.items], data.tva_rate
    )
    quote = Quote(
        organization_id=user.organization_id,
        created_by_id=user.id,
        quote_number=quote_number,
        lead_id=data.lead_id,
        client_id=data.client_id,
        issue_date=data.issue_date,
        valid_until=data.valid_until or (data.issue_date + timedelta(days=30)),
        items=[item.model_dump() for item in data.items],
        total_ht=_to_decimal(total_ht),
        tva_rate=_to_decimal(data.tva_rate),
        tva_amount=_to_decimal(tva_amount),
        total_ttc=_to_decimal(total_ttc),
        notes=data.notes,
    )
    db.add(quote)
    await db.flush()
    return quote


@router.patch("/quotes/{quote_id}", response_model=QuoteResponse)
async def update_quote(
    quote_id: UUID,
    data: QuoteUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    quote = await db.get(Quote, quote_id)
    if not quote or quote.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Devis introuvable")
    payload = data.model_dump(exclude_unset=True)
    if payload.get("items") is not None or payload.get("tva_rate") is not None:
        items = payload.get("items") or quote.items
        tva_rate = payload.get("tva_rate") or float(quote.tva_rate)
        total_ht, tva_amount, total_ttc = _compute_totals(items, float(tva_rate))
        quote.items = items
        quote.total_ht = _to_decimal(total_ht)
        quote.tva_rate = _to_decimal(float(tva_rate))
        quote.tva_amount = _to_decimal(tva_amount)
        quote.total_ttc = _to_decimal(total_ttc)
    for key, value in payload.items():
        if key in {"items", "tva_rate"}:
            continue
        setattr(quote, key, value)
    await db.flush()
    return quote


@router.post("/quotes/{quote_id}/accept", response_model=QuoteResponse)
async def accept_quote(
    quote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    quote = await db.get(Quote, quote_id)
    if not quote or quote.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Devis introuvable")
    quote.status = QuoteStatus.ACCEPTED
    await db.flush()
    return quote


@router.post("/quotes/{quote_id}/convert-to-invoice", response_model=InvoiceResponse, status_code=201)
async def convert_quote_to_invoice(
    quote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    quote = await db.get(Quote, quote_id)
    if not quote or quote.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Devis introuvable")
    if quote.status != QuoteStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Le devis doit être accepté avant conversion")
    result = await db.execute(select(Invoice).where(Invoice.organization_id == user.organization_id))
    invoice_number = _build_number("FAC", len(result.scalars().all()))
    invoice = Invoice(
        organization_id=user.organization_id,
        created_by_id=user.id,
        quote_id=quote.id,
        client_id=quote.client_id,
        invoice_number=invoice_number,
        issue_date=date.today(),
        due_date=date.today() + timedelta(days=30),
        items=quote.items,
        total_ht=quote.total_ht,
        tva_rate=quote.tva_rate,
        tva_amount=quote.tva_amount,
        total_ttc=quote.total_ttc,
        paid_amount=_to_decimal(0),
        balance_due=quote.total_ttc,
        status=InvoiceStatus.SENT,
    )
    db.add(invoice)
    await db.flush()
    return invoice


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Invoice).where(Invoice.organization_id == user.organization_id).order_by(Invoice.created_at.desc())
    )
    invoices = result.scalars().all()
    today = date.today()
    for invoice in invoices:
        if invoice.status not in {InvoiceStatus.PAID, InvoiceStatus.CANCELLED} and invoice.due_date < today:
            invoice.status = InvoiceStatus.OVERDUE
    return invoices


@router.post("/invoices", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Invoice).where(Invoice.organization_id == user.organization_id))
    invoice_number = _build_number("FAC", len(result.scalars().all()))
    total_ht, tva_amount, total_ttc = _compute_totals(
        [item.model_dump() if hasattr(item, "model_dump") else item for item in data.items], data.tva_rate
    )
    invoice = Invoice(
        organization_id=user.organization_id,
        created_by_id=user.id,
        quote_id=data.quote_id,
        client_id=data.client_id,
        invoice_number=invoice_number,
        issue_date=data.issue_date,
        due_date=data.due_date or (data.issue_date + timedelta(days=30)),
        items=[item.model_dump() for item in data.items],
        total_ht=_to_decimal(total_ht),
        tva_rate=_to_decimal(data.tva_rate),
        tva_amount=_to_decimal(tva_amount),
        total_ttc=_to_decimal(total_ttc),
        paid_amount=_to_decimal(0),
        balance_due=_to_decimal(total_ttc),
        status=InvoiceStatus.DRAFT,
        notes=data.notes,
    )
    db.add(invoice)
    await db.flush()
    return invoice


@router.patch("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: UUID,
    data: InvoiceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(invoice, key, value)
    await db.flush()
    return invoice


@router.get("/payments", response_model=list[PaymentResponse])
async def list_payments(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    invoice_id: UUID | None = None,
):
    stmt = select(Payment).where(Payment.organization_id == user.organization_id).order_by(Payment.created_at.desc())
    if invoice_id:
        stmt = stmt.where(Payment.invoice_id == invoice_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentResponse, status_code=201)
async def add_payment(
    invoice_id: UUID,
    data: PaymentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    payment = Payment(
        organization_id=user.organization_id,
        invoice_id=invoice.id,
        created_by_id=user.id,
        amount=_to_decimal(data.amount),
        payment_date=data.payment_date,
        method=data.method,
        reference=data.reference,
        notes=data.notes,
    )
    db.add(payment)
    paid_total = float(invoice.paid_amount) + data.amount
    balance = max(float(invoice.total_ttc) - paid_total, 0)
    invoice.paid_amount = _to_decimal(paid_total)
    invoice.balance_due = _to_decimal(balance)
    if balance <= 0:
        invoice.status = InvoiceStatus.PAID
    elif paid_total > 0:
        invoice.status = InvoiceStatus.PARTIAL
    await db.flush()
    return payment


@router.get("/kpis", response_model=BillingKpis)
async def billing_kpis(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    today = date.today()
    invoices_result = await db.execute(select(Invoice).where(Invoice.organization_id == user.organization_id))
    invoices = invoices_result.scalars().all()
    quotes_result = await db.execute(select(Quote).where(Quote.organization_id == user.organization_id))
    quotes = quotes_result.scalars().all()
    payments_result = await db.execute(select(Payment).where(Payment.organization_id == user.organization_id))
    payments = payments_result.scalars().all()

    invoiced_month = sum(
        float(invoice.total_ttc)
        for invoice in invoices
        if invoice.issue_date.month == today.month and invoice.issue_date.year == today.year
    )
    collected_month = sum(
        float(payment.amount)
        for payment in payments
        if payment.payment_date.month == today.month and payment.payment_date.year == today.year
    )
    overdue = len(
        [
            invoice
            for invoice in invoices
            if invoice.status not in {InvoiceStatus.PAID, InvoiceStatus.CANCELLED}
            and invoice.due_date < today
        ]
    )
    pending_quotes = len([quote for quote in quotes if quote.status in {QuoteStatus.DRAFT, QuoteStatus.SENT}])
    return BillingKpis(
        invoiced_month=round(invoiced_month, 2),
        overdue_invoices=overdue,
        pending_quotes=pending_quotes,
        collected_month=round(collected_month, 2),
    )
