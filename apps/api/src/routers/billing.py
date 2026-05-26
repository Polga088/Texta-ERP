from __future__ import annotations

import io
import os
import re
from pathlib import Path
from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import and_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.core.database import get_db
from src.core.deps import get_current_user
from src.models.billing import BillingAttachment, Invoice, InvoiceStatus, Payment, Product, Quote, QuoteStatus
from src.models.crm import Account, Lead, LeadStatus
from src.models.organization import User
from src.schemas.billing import (
    BillingAttachmentResponse,
    BillingKpis,
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
    PaymentCreate,
    PaymentResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    QuoteCreate,
    QuoteResponse,
    QuoteUpdate,
)
from src.services.audit import log_audit
from src.services.pdf_generator import build_commercial_pdf

router = APIRouter()
settings = get_settings()
ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".docx", ".xlsx"}
ALLOWED_UPLOAD_MIME_PREFIXES = ("image/", "text/")
ALLOWED_UPLOAD_MIME_EXACT = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _build_number(prefix: str, count: int) -> str:
    return f"{prefix}-{date.today().year}-{str(count + 1).zfill(4)}"


async def _next_document_number(
    db: AsyncSession,
    organization_id: UUID,
    *,
    prefix: str,
    field_name: str,
    model: type[Quote] | type[Invoice],
    issue_date: date | None = None,
) -> str:
    year = (issue_date or date.today()).year
    lock_key = (organization_id.int ^ year ^ (1 if prefix == "DEV" else 2)) % 9223372036854775807
    await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})
    pattern = f"{prefix}-{year}-%"
    field = getattr(model, field_name)
    result = await db.execute(
        select(field)
        .where(and_(model.organization_id == organization_id, field.like(pattern)))
        .order_by(field.desc())
    )
    current_max = 0
    for value in result.scalars().all():
        match = re.match(rf"^{prefix}-{year}-(\d+)$", value or "")
        if match:
            current_max = max(current_max, int(match.group(1)))
    return f"{prefix}-{year}-{str(current_max + 1).zfill(4)}"


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


def _sanitize_filename(filename: str) -> str:
    safe = Path(filename).name.strip()
    return safe or "document.bin"


def _attachment_dir(entity: str, entity_id: UUID) -> Path:
    base = Path(settings.billing_files_dir)
    target = base / entity / str(entity_id)
    target.mkdir(parents=True, exist_ok=True)
    return target


async def _save_attachment_file(entity: str, entity_id: UUID, file: UploadFile) -> tuple[str, int]:
    target_dir = _attachment_dir(entity, entity_id)
    extension = Path(file.filename or "").suffix.lower()
    content_type = (file.content_type or "").lower()
    if extension not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Extension de fichier non autorisee")
    if not (
        content_type in ALLOWED_UPLOAD_MIME_EXACT
        or any(content_type.startswith(prefix) for prefix in ALLOWED_UPLOAD_MIME_PREFIXES)
    ):
        raise HTTPException(status_code=400, detail="Type de fichier non autorise")
    storage_name = f"{uuid4().hex}{extension}"
    output_path = target_dir / storage_name

    total_size = 0
    max_size = settings.billing_max_upload_mb * 1024 * 1024
    with output_path.open("wb") as destination:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > max_size:
                destination.close()
                output_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Fichier trop volumineux")
            destination.write(chunk)
    await file.close()
    return str(output_path), total_size


async def _normalize_items(
    db: AsyncSession,
    organization_id: UUID,
    items: list[dict],
) -> list[dict]:
    normalized: list[dict] = []
    for item in items:
        current = dict(item)
        product_id = current.get("product_id")
        if product_id:
            product = await db.get(Product, product_id)
            if not product or product.organization_id != organization_id:
                raise HTTPException(status_code=404, detail="Produit introuvable")
            current["product_id"] = str(product.id)
            if not current.get("description"):
                current["description"] = product.name
            if not current.get("unit_price"):
                current["unit_price"] = float(product.unit_price)
        normalized.append(current)
    return normalized


def _build_pdf_document(
    title: str,
    document_number: str,
    issue_date: date,
    due_date: date | None,
    items: list[dict],
    total_ht: float,
    tva_amount: float,
    total_ttc: float,
) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 60

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(50, y, title)
    y -= 28
    pdf.setFont("Helvetica", 11)
    pdf.drawString(50, y, f"Numero: {document_number}")
    y -= 18
    pdf.drawString(50, y, f"Date emission: {issue_date.isoformat()}")
    if due_date:
        y -= 18
        pdf.drawString(50, y, f"Date echeance: {due_date.isoformat()}")

    y -= 28
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(50, y, "Description")
    pdf.drawString(330, y, "Qt")
    pdf.drawString(390, y, "PU HT")
    pdf.drawString(470, y, "Total HT")
    y -= 14
    pdf.line(50, y, width - 50, y)
    y -= 18
    pdf.setFont("Helvetica", 10)
    for item in items:
        desc = str(item.get("description") or "Ligne")
        qty = float(item.get("qty") or 0)
        unit = float(item.get("unit_price") or 0)
        line_total = float(item.get("total_ht") or (qty * unit))
        pdf.drawString(50, y, desc[:52])
        pdf.drawRightString(360, y, f"{qty:.2f}")
        pdf.drawRightString(440, y, f"{unit:.2f} EUR")
        pdf.drawRightString(width - 50, y, f"{line_total:.2f} EUR")
        y -= 16
        if y < 120:
            pdf.showPage()
            y = height - 70
            pdf.setFont("Helvetica", 10)

    y -= 8
    pdf.line(360, y, width - 50, y)
    y -= 20
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawRightString(width - 50, y, f"Total HT: {total_ht:.2f} EUR")
    y -= 18
    pdf.drawRightString(width - 50, y, f"TVA: {tva_amount:.2f} EUR")
    y -= 18
    pdf.drawRightString(width - 50, y, f"Total TTC: {total_ttc:.2f} EUR")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


@router.get("/products", response_model=list[ProductResponse])
async def list_products(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Product)
        .where(Product.organization_id == user.organization_id)
        .order_by(Product.updated_at.desc())
    )
    return result.scalars().all()


@router.post("/products", response_model=ProductResponse, status_code=201)
async def create_product(
    data: ProductCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    existing = await db.execute(
        select(Product).where(
            Product.organization_id == user.organization_id,
            Product.sku == data.sku.strip().upper(),
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="SKU deja utilise")
    product = Product(
        organization_id=user.organization_id,
        created_by_id=user.id,
        sku=data.sku.strip().upper(),
        name=data.name.strip(),
        category=data.category,
        description=data.description,
        unit_price=_to_decimal(data.unit_price),
        tva_rate=_to_decimal(data.tva_rate),
        is_active=data.is_active,
    )
    db.add(product)
    await db.flush()
    return product


@router.get("/products/search", response_model=list[ProductResponse])
async def search_products(
    q: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    needle = f"%{q.strip()}%"
    result = await db.execute(
        select(Product)
        .where(
            Product.organization_id == user.organization_id,
            Product.is_active.is_(True),
            Product.name.ilike(needle) | Product.sku.ilike(needle) | Product.category.ilike(needle),
        )
        .order_by(Product.name.asc())
        .limit(30)
    )
    return result.scalars().all()


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    data: ProductUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    product = await db.get(Product, product_id)
    if not product or product.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "sku" and value:
            setattr(product, key, value.strip().upper())
        elif key in {"unit_price", "tva_rate"} and value is not None:
            setattr(product, key, _to_decimal(value))
        elif isinstance(value, str):
            setattr(product, key, value.strip())
        else:
            setattr(product, key, value)
    await db.flush()
    return product


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    product = await db.get(Product, product_id)
    if not product or product.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    await db.delete(product)
    await db.flush()
    return None


@router.get("/quotes", response_model=list[QuoteResponse])
async def list_quotes(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: QuoteStatus | None = None,
    client_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    stmt = select(Quote).where(Quote.organization_id == user.organization_id)
    if status:
        stmt = stmt.where(Quote.status == status)
    if client_id:
        stmt = stmt.where(Quote.client_id == client_id)
    if date_from:
        stmt = stmt.where(Quote.issue_date >= date_from)
    if date_to:
        stmt = stmt.where(Quote.issue_date <= date_to)
    result = await db.execute(stmt.order_by(Quote.created_at.desc()))
    return result.scalars().all()


@router.get("/quotes/{quote_id}", response_model=QuoteResponse)
async def get_quote(
    quote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    quote = await db.get(Quote, quote_id)
    if not quote or quote.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Devis introuvable")
    return quote


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
    quote_number = await _next_document_number(
        db,
        user.organization_id,
        prefix="DEV",
        field_name="quote_number",
        model=Quote,
        issue_date=data.issue_date,
    )
    normalized_items = await _normalize_items(
        db,
        user.organization_id,
        [item.model_dump() if hasattr(item, "model_dump") else item for item in data.items],
    )
    total_ht, tva_amount, total_ttc = _compute_totals(
        normalized_items, data.tva_rate
    )
    quote = Quote(
        organization_id=user.organization_id,
        created_by_id=user.id,
        quote_number=quote_number,
        lead_id=data.lead_id,
        client_id=data.client_id,
        issue_date=data.issue_date,
        valid_until=data.valid_until or (data.issue_date + timedelta(days=30)),
        items=normalized_items,
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
    if quote.status != QuoteStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Seuls les devis en brouillon peuvent etre modifies")
    payload = data.model_dump(exclude_unset=True)
    if payload.get("items") is not None or payload.get("tva_rate") is not None:
        items = await _normalize_items(db, user.organization_id, payload.get("items") or quote.items)
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


@router.put("/quotes/{quote_id}", response_model=QuoteResponse)
async def replace_quote(
    quote_id: UUID,
    data: QuoteUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    return await update_quote(quote_id=quote_id, data=data, db=db, user=user)


@router.post("/quotes/{quote_id}/duplicate", response_model=QuoteResponse, status_code=201)
async def duplicate_quote(
    quote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    original = await db.get(Quote, quote_id)
    if not original or original.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Devis introuvable")
    quote_number = await _next_document_number(
        db,
        user.organization_id,
        prefix="DEV",
        field_name="quote_number",
        model=Quote,
        issue_date=date.today(),
    )
    cloned_items = [dict(item) for item in original.items]
    cloned = Quote(
        organization_id=user.organization_id,
        created_by_id=user.id,
        quote_number=quote_number,
        lead_id=original.lead_id,
        client_id=original.client_id,
        issue_date=date.today(),
        valid_until=date.today() + timedelta(days=30),
        items=cloned_items,
        total_ht=original.total_ht,
        tva_rate=original.tva_rate,
        tva_amount=original.tva_amount,
        total_ttc=original.total_ttc,
        status=QuoteStatus.DRAFT,
        notes=original.notes,
    )
    db.add(cloned)
    await db.flush()
    return cloned


@router.post("/quotes/{lead_id}/from-lead", response_model=QuoteResponse, status_code=201)
async def create_quote_from_lead(
    lead_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    lead = await db.get(Lead, lead_id)
    if not lead or lead.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Lead introuvable")
    if lead.status != LeadStatus.WON:
        raise HTTPException(status_code=400, detail="Le lead doit etre gagne")
    if not lead.account_id:
        raise HTTPException(status_code=400, detail="Le lead doit etre lie a un client")
    quote_number = await _next_document_number(
        db,
        user.organization_id,
        prefix="DEV",
        field_name="quote_number",
        model=Quote,
        issue_date=date.today(),
    )
    base_amount = float(lead.deal_value or 0)
    item_description = lead.product_service or lead.title
    total_ht, tva_amount, total_ttc = _compute_totals(
        [{"description": item_description, "qty": 1, "unit_price": base_amount, "discount_percent": 0}],
        20,
    )
    quote = Quote(
        organization_id=user.organization_id,
        created_by_id=user.id,
        quote_number=quote_number,
        lead_id=lead.id,
        client_id=lead.account_id,
        issue_date=date.today(),
        valid_until=date.today() + timedelta(days=30),
        items=[
            {
                "description": item_description,
                "qty": 1,
                "unit_price": base_amount,
                "discount_percent": 0,
                "total_ht": total_ht,
            }
        ],
        total_ht=_to_decimal(total_ht),
        tva_rate=_to_decimal(20),
        tva_amount=_to_decimal(tva_amount),
        total_ttc=_to_decimal(total_ttc),
        notes=f"Genere depuis lead {lead.title}",
    )
    db.add(quote)
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


@router.post("/quotes/{quote_id}/send", response_model=QuoteResponse)
async def send_quote(
    quote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    quote = await db.get(Quote, quote_id)
    if not quote or quote.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Devis introuvable")
    if quote.status in {QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED}:
        raise HTTPException(status_code=400, detail="Ce devis ne peut plus etre envoye")
    quote.status = QuoteStatus.SENT
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
    invoice_number = await _next_document_number(
        db,
        user.organization_id,
        prefix="FAC",
        field_name="invoice_number",
        model=Invoice,
        issue_date=date.today(),
    )
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


@router.delete("/quotes/{quote_id}", status_code=204)
async def delete_quote(
    quote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    quote = await db.get(Quote, quote_id)
    if not quote or quote.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Devis introuvable")
    if quote.status != QuoteStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Seuls les devis brouillon peuvent etre supprimes")
    await db.delete(quote)
    await db.flush()
    return None


@router.get("/quotes/{quote_id}/pdf")
async def download_quote_pdf(
    quote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    quote = await db.get(Quote, quote_id)
    if not quote or quote.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Devis introuvable")
    account = await db.get(Account, quote.client_id) if quote.client_id else None
    try:
        payload = build_commercial_pdf(
            title="DEVIS",
            number=quote.quote_number,
            issue_date=quote.issue_date,
            valid_until=quote.valid_until,
            client_name=account.name if account else "Client",
            client_meta=f"Client ID: {quote.client_id}" if quote.client_id else "Client non renseigne",
            items=quote.items,
            total_ht=quote.total_ht,
            tva_rate=quote.tva_rate,
            tva_amount=quote.tva_amount,
            total_ttc=quote.total_ttc,
        )
    except Exception:
        payload = _build_pdf_document(
            title="Devis client",
            document_number=quote.quote_number,
            issue_date=quote.issue_date,
            due_date=quote.valid_until,
            items=quote.items,
            total_ht=float(quote.total_ht),
            tva_amount=float(quote.tva_amount),
            total_ttc=float(quote.total_ttc),
        )
    filename = f"{quote.quote_number}.pdf"
    return Response(
        content=payload,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: InvoiceStatus | None = None,
    client_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    stmt = select(Invoice).where(Invoice.organization_id == user.organization_id)
    if status:
        stmt = stmt.where(Invoice.status == status)
    if client_id:
        stmt = stmt.where(Invoice.client_id == client_id)
    if date_from:
        stmt = stmt.where(Invoice.issue_date >= date_from)
    if date_to:
        stmt = stmt.where(Invoice.issue_date <= date_to)
    result = await db.execute(stmt.order_by(Invoice.created_at.desc()))
    invoices = result.scalars().all()
    today = date.today()
    for invoice in invoices:
        if invoice.status in {InvoiceStatus.SENT, InvoiceStatus.PARTIAL} and invoice.due_date < today:
            invoice.status = InvoiceStatus.OVERDUE
    return invoices


@router.get("/invoices/overdue", response_model=list[InvoiceResponse])
async def list_overdue_invoices(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    today = date.today()
    result = await db.execute(
        select(Invoice)
        .where(
            Invoice.organization_id == user.organization_id,
            Invoice.due_date < today,
            Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE]),
        )
        .order_by(Invoice.due_date.asc())
    )
    invoices = result.scalars().all()
    for invoice in invoices:
        invoice.status = InvoiceStatus.OVERDUE
    return invoices


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    return invoice


@router.post("/invoices", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    invoice_number = await _next_document_number(
        db,
        user.organization_id,
        prefix="FAC",
        field_name="invoice_number",
        model=Invoice,
        issue_date=data.issue_date,
    )
    normalized_items = await _normalize_items(
        db,
        user.organization_id,
        [item.model_dump() if hasattr(item, "model_dump") else item for item in data.items],
    )
    total_ht, tva_amount, total_ttc = _compute_totals(
        normalized_items, data.tva_rate
    )
    invoice = Invoice(
        organization_id=user.organization_id,
        created_by_id=user.id,
        quote_id=data.quote_id,
        client_id=data.client_id,
        invoice_number=invoice_number,
        issue_date=data.issue_date,
        due_date=data.due_date or (data.issue_date + timedelta(days=30)),
        items=normalized_items,
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


@router.post("/invoices/{invoice_id}/send", response_model=InvoiceResponse)
async def send_invoice(
    invoice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if invoice.status in {InvoiceStatus.PAID, InvoiceStatus.CANCELLED}:
        raise HTTPException(status_code=400, detail="Cette facture ne peut pas etre envoyee")
    invoice.status = InvoiceStatus.SENT
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
    payload = data.model_dump(exclude_unset=True)
    if payload.get("items") is not None or payload.get("tva_rate") is not None:
        items = await _normalize_items(db, user.organization_id, payload.get("items") or invoice.items)
        tva_rate = payload.get("tva_rate") or float(invoice.tva_rate)
        total_ht, tva_amount, total_ttc = _compute_totals(items, float(tva_rate))
        invoice.items = items
        invoice.total_ht = _to_decimal(total_ht)
        invoice.tva_rate = _to_decimal(float(tva_rate))
        invoice.tva_amount = _to_decimal(tva_amount)
        invoice.total_ttc = _to_decimal(total_ttc)
        balance = max(total_ttc - float(invoice.paid_amount), 0)
        invoice.balance_due = _to_decimal(balance)
    for key, value in payload.items():
        if key in {"items", "tva_rate"}:
            continue
        setattr(invoice, key, value)
    await db.flush()
    return invoice


@router.post("/invoices/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(
    invoice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    invoice.status = InvoiceStatus.CANCELLED
    await db.flush()
    return invoice


@router.delete("/invoices/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Seules les factures brouillon peuvent etre supprimees")
    has_payment = await db.execute(
        select(Payment.id).where(Payment.organization_id == user.organization_id, Payment.invoice_id == invoice.id).limit(1)
    )
    if has_payment.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Une facture avec paiements ne peut pas etre supprimee")
    await db.delete(invoice)
    await db.flush()
    return None


@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    account = await db.get(Account, invoice.client_id) if invoice.client_id else None
    try:
        payload = build_commercial_pdf(
            title="FACTURE",
            number=invoice.invoice_number,
            issue_date=invoice.issue_date,
            valid_until=invoice.due_date,
            client_name=account.name if account else "Client",
            client_meta=f"Client ID: {invoice.client_id}" if invoice.client_id else "Client non renseigne",
            items=invoice.items,
            total_ht=invoice.total_ht,
            tva_rate=invoice.tva_rate,
            tva_amount=invoice.tva_amount,
            total_ttc=invoice.total_ttc,
        )
    except Exception:
        payload = _build_pdf_document(
            title="Facture client",
            document_number=invoice.invoice_number,
            issue_date=invoice.issue_date,
            due_date=invoice.due_date,
            items=invoice.items,
            total_ht=float(invoice.total_ht),
            tva_amount=float(invoice.tva_amount),
            total_ttc=float(invoice.total_ttc),
        )
    filename = f"{invoice.invoice_number}.pdf"
    return Response(
        content=payload,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/quotes/{quote_id}/attachments", response_model=list[BillingAttachmentResponse])
async def list_quote_attachments(
    quote_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    quote = await db.get(Quote, quote_id)
    if not quote or quote.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Devis introuvable")
    result = await db.execute(
        select(BillingAttachment)
        .where(
            BillingAttachment.organization_id == user.organization_id,
            BillingAttachment.quote_id == quote_id,
        )
        .order_by(BillingAttachment.created_at.desc())
    )
    return result.scalars().all()


@router.post("/quotes/{quote_id}/attachments", response_model=BillingAttachmentResponse, status_code=201)
async def upload_quote_attachment(
    quote_id: UUID,
    file: Annotated[UploadFile, File(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    quote = await db.get(Quote, quote_id)
    if not quote or quote.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Devis introuvable")
    storage_path, size_bytes = await _save_attachment_file("quotes", quote_id, file)
    attachment = BillingAttachment(
        organization_id=user.organization_id,
        quote_id=quote_id,
        uploaded_by_id=user.id,
        original_filename=_sanitize_filename(file.filename or "document.bin"),
        content_type=file.content_type,
        size_bytes=size_bytes,
        storage_path=storage_path,
    )
    db.add(attachment)
    await db.flush()
    await log_audit(
        db,
        organization_id=user.organization_id,
        actor_id=user.id,
        action="billing.attachment.upload",
        resource_type="quote_attachment",
        resource_id=str(attachment.id),
        details={
            "quote_id": str(quote_id),
            "filename": attachment.original_filename,
            "size_bytes": attachment.size_bytes,
        },
    )
    return attachment


@router.get("/invoices/{invoice_id}/attachments", response_model=list[BillingAttachmentResponse])
async def list_invoice_attachments(
    invoice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    result = await db.execute(
        select(BillingAttachment)
        .where(
            BillingAttachment.organization_id == user.organization_id,
            BillingAttachment.invoice_id == invoice_id,
        )
        .order_by(BillingAttachment.created_at.desc())
    )
    return result.scalars().all()


@router.post("/invoices/{invoice_id}/attachments", response_model=BillingAttachmentResponse, status_code=201)
async def upload_invoice_attachment(
    invoice_id: UUID,
    file: Annotated[UploadFile, File(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    storage_path, size_bytes = await _save_attachment_file("invoices", invoice_id, file)
    attachment = BillingAttachment(
        organization_id=user.organization_id,
        invoice_id=invoice_id,
        uploaded_by_id=user.id,
        original_filename=_sanitize_filename(file.filename or "document.bin"),
        content_type=file.content_type,
        size_bytes=size_bytes,
        storage_path=storage_path,
    )
    db.add(attachment)
    await db.flush()
    await log_audit(
        db,
        organization_id=user.organization_id,
        actor_id=user.id,
        action="billing.attachment.upload",
        resource_type="invoice_attachment",
        resource_id=str(attachment.id),
        details={
            "invoice_id": str(invoice_id),
            "filename": attachment.original_filename,
            "size_bytes": attachment.size_bytes,
        },
    )
    return attachment


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    attachment = await db.get(BillingAttachment, attachment_id)
    if not attachment or attachment.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if not os.path.exists(attachment.storage_path):
        raise HTTPException(status_code=404, detail="Fichier indisponible")
    return FileResponse(
        path=attachment.storage_path,
        media_type=attachment.content_type or "application/octet-stream",
        filename=attachment.original_filename,
    )


@router.delete("/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    attachment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    attachment = await db.get(BillingAttachment, attachment_id)
    if not attachment or attachment.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Document introuvable")
    quote_id = str(attachment.quote_id) if attachment.quote_id else None
    invoice_id = str(attachment.invoice_id) if attachment.invoice_id else None
    filename = attachment.original_filename
    Path(attachment.storage_path).unlink(missing_ok=True)
    await db.delete(attachment)
    await db.flush()
    await log_audit(
        db,
        organization_id=user.organization_id,
        actor_id=user.id,
        action="billing.attachment.delete",
        resource_type="billing_attachment",
        resource_id=str(attachment_id),
        details={
            "quote_id": quote_id,
            "invoice_id": invoice_id,
            "filename": filename,
        },
    )
    return None


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
