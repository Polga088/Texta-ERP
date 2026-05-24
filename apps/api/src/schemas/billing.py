from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from src.models.billing import InvoiceStatus, PaymentMethod, QuoteStatus
from src.schemas.common import TimestampSchema


class BillingItem(BaseModel):
    product_id: UUID | None = None
    description: str
    qty: float = Field(default=1, gt=0)
    unit_price: float = Field(default=0, ge=0)
    discount_percent: float = Field(default=0, ge=0, le=100)
    total_ht: float = Field(default=0, ge=0)


class ProductCreate(BaseModel):
    sku: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=255)
    category: str | None = None
    description: str | None = None
    unit_price: float = Field(default=0, ge=0)
    tva_rate: float = Field(default=20, ge=0)
    is_active: bool = True


class ProductUpdate(BaseModel):
    sku: str | None = Field(default=None, min_length=2, max_length=80)
    name: str | None = Field(default=None, min_length=2, max_length=255)
    category: str | None = None
    description: str | None = None
    unit_price: float | None = Field(default=None, ge=0)
    tva_rate: float | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProductResponse(TimestampSchema):
    id: UUID
    sku: str
    name: str
    category: str | None
    description: str | None
    unit_price: Decimal
    tva_rate: Decimal
    is_active: bool
    organization_id: UUID
    created_by_id: UUID | None


class BillingAttachmentResponse(TimestampSchema):
    id: UUID
    quote_id: UUID | None
    invoice_id: UUID | None
    original_filename: str
    content_type: str | None
    size_bytes: int
    organization_id: UUID
    uploaded_by_id: UUID | None


class QuoteCreate(BaseModel):
    lead_id: UUID | None = None
    client_id: UUID | None = None
    issue_date: date
    valid_until: date | None = None
    items: list[BillingItem] = Field(default_factory=list)
    tva_rate: float = Field(default=20, ge=0)
    notes: str | None = None


class QuoteUpdate(BaseModel):
    issue_date: date | None = None
    valid_until: date | None = None
    items: list[BillingItem] | None = None
    tva_rate: float | None = Field(default=None, ge=0)
    status: QuoteStatus | None = None
    notes: str | None = None
    pdf_url: str | None = None


class QuoteResponse(TimestampSchema):
    id: UUID
    quote_number: str
    lead_id: UUID | None
    client_id: UUID | None
    issue_date: date
    valid_until: date
    items: list[dict]
    total_ht: Decimal
    tva_rate: Decimal
    tva_amount: Decimal
    total_ttc: Decimal
    status: QuoteStatus
    pdf_url: str | None
    notes: str | None
    organization_id: UUID
    created_by_id: UUID | None


class InvoiceCreate(BaseModel):
    quote_id: UUID | None = None
    client_id: UUID | None = None
    issue_date: date
    due_date: date | None = None
    items: list[BillingItem] = Field(default_factory=list)
    tva_rate: float = Field(default=20, ge=0)
    notes: str | None = None


class InvoiceUpdate(BaseModel):
    due_date: date | None = None
    items: list[BillingItem] | None = None
    tva_rate: float | None = Field(default=None, ge=0)
    status: InvoiceStatus | None = None
    notes: str | None = None
    pdf_url: str | None = None


class InvoiceResponse(TimestampSchema):
    id: UUID
    quote_id: UUID | None
    invoice_number: str
    client_id: UUID | None
    issue_date: date
    due_date: date
    items: list[dict]
    total_ht: Decimal
    tva_rate: Decimal
    tva_amount: Decimal
    total_ttc: Decimal
    paid_amount: Decimal
    balance_due: Decimal
    status: InvoiceStatus
    pdf_url: str | None
    notes: str | None
    organization_id: UUID
    created_by_id: UUID | None


class PaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    payment_date: date
    method: PaymentMethod = PaymentMethod.TRANSFER
    reference: str | None = None
    notes: str | None = None


class PaymentResponse(TimestampSchema):
    id: UUID
    invoice_id: UUID
    amount: Decimal
    payment_date: date
    method: PaymentMethod
    reference: str | None
    notes: str | None
    organization_id: UUID
    created_by_id: UUID | None


class BillingKpis(BaseModel):
    invoiced_month: float
    overdue_invoices: int
    pending_quotes: int
    collected_month: float
