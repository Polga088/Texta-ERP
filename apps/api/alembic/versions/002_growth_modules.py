"""Add growth modules: leads, collaboration, time tracking, project profile fields

Revision ID: 002
Revises: 001
Create Date: 2026-05-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return column in {c["name"] for c in inspect(bind).get_columns(table)}


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    return table in inspect(bind).get_table_names()


def _ensure_lead_status_enum() -> None:
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE lead_status AS ENUM ('new', 'qualified', 'proposal', 'won', 'lost');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )


def upgrade() -> None:
    project_columns = {
        "company_name": sa.Column("company_name", sa.String(length=255), nullable=True),
        "company_logo_url": sa.Column("company_logo_url", sa.String(length=500), nullable=True),
        "project_code": sa.Column("project_code", sa.String(length=60), nullable=True),
        "quality_standard": sa.Column("quality_standard", sa.String(length=120), nullable=True),
        "scope_statement": sa.Column("scope_statement", sa.Text(), nullable=True),
    }
    for name, column in project_columns.items():
        if not _column_exists("projects", name):
            op.add_column("projects", column)

    _ensure_lead_status_enum()

    lead_status = postgresql.ENUM(
        "new", "qualified", "proposal", "won", "lost", name="lead_status", create_type=False
    )

    if not _table_exists("leads"):
        op.create_table(
            "leads",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "organization_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "account_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("accounts.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "contact_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("contacts.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("source", sa.String(length=120), nullable=True),
            sa.Column("status", lead_status, nullable=False),
            sa.Column("estimated_value", sa.Numeric(14, 2), nullable=True),
            sa.Column("expected_close_date", sa.Date(), nullable=True),
            sa.Column(
                "owner_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )

    if not _table_exists("chat_messages"):
        op.create_table(
            "chat_messages",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "organization_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "project_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("projects.id", ondelete="CASCADE"),
                nullable=True,
            ),
            sa.Column(
                "sender_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )

    if not _table_exists("notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "organization_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("entity_type", sa.String(length=80), nullable=True),
            sa.Column("entity_id", sa.String(length=80), nullable=True),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )

    if not _table_exists("time_entries"):
        op.create_table(
            "time_entries",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "organization_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "project_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("projects.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "task_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("tasks.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("source", sa.String(length=30), nullable=False, server_default="manual"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )


def downgrade() -> None:
    op.drop_table("time_entries")
    op.drop_table("notifications")
    op.drop_table("chat_messages")
    op.drop_table("leads")
    op.execute("DROP TYPE IF EXISTS lead_status")
    op.drop_column("projects", "scope_statement")
    op.drop_column("projects", "quality_standard")
    op.drop_column("projects", "project_code")
    op.drop_column("projects", "company_logo_url")
    op.drop_column("projects", "company_name")
