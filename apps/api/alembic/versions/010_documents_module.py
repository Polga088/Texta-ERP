"""Add documents table for entity uploads

Revision ID: 010
Revises: 009
Create Date: 2026-05-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "010"
down_revision: Union[str, None] = "009"
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
    bind = op.get_bind()
    document_entity_type = postgresql.ENUM(
        "lead",
        "project",
        "task",
        "quote",
        "invoice",
        "client",
        name="document_entity_type",
    )
    document_entity_type.create(bind, checkfirst=True)

    if not _table_exists("documents"):
        op.create_table(
            "documents",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("entity_type", document_entity_type, nullable=False),
            sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("original_filename", sa.String(length=255), nullable=False),
            sa.Column("stored_filename", sa.String(length=255), nullable=False),
            sa.Column("file_path", sa.String(length=500), nullable=False),
            sa.Column("mime_type", sa.String(length=150), nullable=True),
            sa.Column("file_size", sa.BigInteger(), nullable=False),
            sa.Column("uploaded_by_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    if _table_exists("documents") and not _index_exists("documents", "ix_documents_entity_id"):
        op.create_index("ix_documents_entity_id", "documents", ["entity_id"])
    if _table_exists("documents") and not _index_exists("documents", "ix_documents_organization_id"):
        op.create_index("ix_documents_organization_id", "documents", ["organization_id"])


def downgrade() -> None:
    bind = op.get_bind()
    document_entity_type = postgresql.ENUM(name="document_entity_type")

    if _table_exists("documents"):
        if _index_exists("documents", "ix_documents_organization_id"):
            op.drop_index("ix_documents_organization_id", table_name="documents")
        if _index_exists("documents", "ix_documents_entity_id"):
            op.drop_index("ix_documents_entity_id", table_name="documents")
        op.drop_table("documents")

    document_entity_type.drop(bind, checkfirst=True)
