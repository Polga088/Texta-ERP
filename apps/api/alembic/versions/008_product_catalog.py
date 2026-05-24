"""Add products catalog for billing

Revision ID: 008
Revises: 007
Create Date: 2026-05-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "008"
down_revision: Union[str, None] = "007"
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
    if not _table_exists("products"):
        op.create_table(
            "products",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("sku", sa.String(length=80), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("category", sa.String(length=120), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("unit_price", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("tva_rate", sa.Numeric(5, 2), nullable=False, server_default="20"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("organization_id", "sku", name="uq_products_org_sku"),
        )

    if _table_exists("products") and not _index_exists("products", "ix_products_organization_id"):
        op.create_index("ix_products_organization_id", "products", ["organization_id"])

    if _table_exists("products") and not _index_exists("products", "ix_products_is_active"):
        op.create_index("ix_products_is_active", "products", ["is_active"])


def downgrade() -> None:
    if _table_exists("products"):
        if _index_exists("products", "ix_products_is_active"):
            op.drop_index("ix_products_is_active", table_name="products")
        if _index_exists("products", "ix_products_organization_id"):
            op.drop_index("ix_products_organization_id", table_name="products")
        op.drop_table("products")
