"""Add billing module tables

Revision ID: 007
Revises: 006
Create Date: 2026-05-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    return table in inspect(bind).get_table_names()


def _create_enum(name: str, values: list[str]) -> None:
    quoted = ", ".join([f"'{value}'" for value in values])
    op.execute(
        sa.text(
            f"""
            DO $$
            BEGIN
                CREATE TYPE {name} AS ENUM ({quoted});
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )


def upgrade() -> None:
    _create_enum("quote_status", ["draft", "sent", "accepted", "rejected", "expired"])
    _create_enum("invoice_status", ["draft", "sent", "paid", "partial", "overdue", "cancelled"])
    _create_enum("payment_method", ["transfer", "card", "cash", "check"])

    if not _table_exists("quotes"):
        op.create_table(
            "quotes",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("quote_number", sa.String(length=50), nullable=False),
            sa.Column("issue_date", sa.Date(), nullable=False),
            sa.Column("valid_until", sa.Date(), nullable=False),
            sa.Column("items", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
            sa.Column("total_ht", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("tva_rate", sa.Numeric(5, 2), nullable=False, server_default="20"),
            sa.Column("tva_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("total_ttc", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column(
                "status",
                postgresql.ENUM("draft", "sent", "accepted", "rejected", "expired", name="quote_status", create_type=False),
                nullable=False,
                server_default="draft",
            ),
            sa.Column("pdf_url", sa.String(length=500), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["client_id"], ["accounts.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("quote_number"),
        )

    if not _table_exists("invoices"):
        op.create_table(
            "invoices",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("quote_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("invoice_number", sa.String(length=50), nullable=False),
            sa.Column("issue_date", sa.Date(), nullable=False),
            sa.Column("due_date", sa.Date(), nullable=False),
            sa.Column("items", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
            sa.Column("total_ht", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("tva_rate", sa.Numeric(5, 2), nullable=False, server_default="20"),
            sa.Column("tva_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("total_ttc", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("paid_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("balance_due", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column(
                "status",
                postgresql.ENUM("draft", "sent", "paid", "partial", "overdue", "cancelled", name="invoice_status", create_type=False),
                nullable=False,
                server_default="draft",
            ),
            sa.Column("pdf_url", sa.String(length=500), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["quote_id"], ["quotes.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["client_id"], ["accounts.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("invoice_number"),
        )

    if not _table_exists("payments"):
        op.create_table(
            "payments",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("amount", sa.Numeric(14, 2), nullable=False),
            sa.Column("payment_date", sa.Date(), nullable=False),
            sa.Column(
                "method",
                postgresql.ENUM("transfer", "card", "cash", "check", name="payment_method", create_type=False),
                nullable=False,
                server_default="transfer",
            ),
            sa.Column("reference", sa.String(length=120), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    if _table_exists("payments"):
        op.drop_table("payments")
    if _table_exists("invoices"):
        op.drop_table("invoices")
    if _table_exists("quotes"):
        op.drop_table("quotes")
