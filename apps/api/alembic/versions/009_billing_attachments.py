"""Add billing attachments table

Revision ID: 009
Revises: 008
Create Date: 2026-05-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    return table in inspect(bind).get_table_names()


def _index_exists(table: str, index_name: str) -> bool:
    bind = op.get_bind()
    indexes = inspect(bind).get_indexes(table)
    return any(index.get("name") == index_name for index in indexes)


def upgrade() -> None:
    if not _table_exists("billing_attachments"):
        op.create_table(
            "billing_attachments",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("quote_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("uploaded_by_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("original_filename", sa.String(length=255), nullable=False),
            sa.Column("content_type", sa.String(length=120), nullable=True),
            sa.Column("size_bytes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("storage_path", sa.String(length=800), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["quote_id"], ["quotes.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    if _table_exists("billing_attachments") and not _index_exists(
        "billing_attachments", "ix_billing_attachments_organization_id"
    ):
        op.create_index("ix_billing_attachments_organization_id", "billing_attachments", ["organization_id"])

    if _table_exists("billing_attachments") and not _index_exists(
        "billing_attachments", "ix_billing_attachments_quote_id"
    ):
        op.create_index("ix_billing_attachments_quote_id", "billing_attachments", ["quote_id"])

    if _table_exists("billing_attachments") and not _index_exists(
        "billing_attachments", "ix_billing_attachments_invoice_id"
    ):
        op.create_index("ix_billing_attachments_invoice_id", "billing_attachments", ["invoice_id"])


def downgrade() -> None:
    if _table_exists("billing_attachments"):
        if _index_exists("billing_attachments", "ix_billing_attachments_invoice_id"):
            op.drop_index("ix_billing_attachments_invoice_id", table_name="billing_attachments")
        if _index_exists("billing_attachments", "ix_billing_attachments_quote_id"):
            op.drop_index("ix_billing_attachments_quote_id", table_name="billing_attachments")
        if _index_exists("billing_attachments", "ix_billing_attachments_organization_id"):
            op.drop_index("ix_billing_attachments_organization_id", table_name="billing_attachments")
        op.drop_table("billing_attachments")
