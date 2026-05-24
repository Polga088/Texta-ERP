"""Add rich lead pipeline fields

Revision ID: 004
Revises: 003
Create Date: 2026-05-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return column in {c["name"] for c in inspect(bind).get_columns(table)}


def _create_enum(name: str, values: list[str]) -> None:
    quoted = ", ".join([f"'{value}'" for value in values])
    op.execute(
        sa.text(
            f"""
            DO $$ BEGIN
                CREATE TYPE {name} AS ENUM ({quoted});
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )


def upgrade() -> None:
    _create_enum("lead_currency", ["MAD", "EUR", "USD"])
    _create_enum("lead_priority", ["high", "medium", "low"])
    _create_enum("lead_next_action_type", ["call", "email", "meeting", "quote", "follow_up", "none"])
    _create_enum(
        "lead_lost_reason",
        ["price_too_high", "wrong_timing", "competitor", "no_budget", "internal_decision", "other"],
    )

    fields = {
        "contact_name": sa.Column("contact_name", sa.String(length=255), nullable=True),
        "contact_email": sa.Column("contact_email", sa.String(length=255), nullable=True),
        "contact_phone": sa.Column("contact_phone", sa.String(length=50), nullable=True),
        "company_name": sa.Column("company_name", sa.String(length=255), nullable=True),
        "company_website": sa.Column("company_website", sa.String(length=500), nullable=True),
        "contact_job_title": sa.Column("contact_job_title", sa.String(length=120), nullable=True),
        "deal_value": sa.Column("deal_value", sa.Numeric(14, 2), nullable=True),
        "currency": sa.Column(
            "currency",
            postgresql.ENUM("MAD", "EUR", "USD", name="lead_currency", create_type=False),
            nullable=False,
            server_default="MAD",
        ),
        "product_service": sa.Column("product_service", sa.String(length=120), nullable=True),
        "conversion_probability": sa.Column("conversion_probability", sa.Integer(), nullable=True),
        "priority": sa.Column(
            "priority",
            postgresql.ENUM("high", "medium", "low", name="lead_priority", create_type=False),
            nullable=False,
            server_default="medium",
        ),
        "marketing_campaign": sa.Column("marketing_campaign", sa.String(length=255), nullable=True),
        "assigned_to": sa.Column(
            "assigned_to",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        "last_activity": sa.Column(
            "last_activity",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        "next_action_type": sa.Column(
            "next_action_type",
            postgresql.ENUM(
                "call",
                "email",
                "meeting",
                "quote",
                "follow_up",
                "none",
                name="lead_next_action_type",
                create_type=False,
            ),
            nullable=False,
            server_default="none",
        ),
        "next_action_date": sa.Column("next_action_date", sa.Date(), nullable=True),
        "next_action_note": sa.Column("next_action_note", sa.Text(), nullable=True),
        "description": sa.Column("description", sa.Text(), nullable=True),
        "tags": sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        "attachments": sa.Column(
            "attachments", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"
        ),
        "lost_reason": sa.Column(
            "lost_reason",
            postgresql.ENUM(
                "price_too_high",
                "wrong_timing",
                "competitor",
                "no_budget",
                "internal_decision",
                "other",
                name="lead_lost_reason",
                create_type=False,
            ),
            nullable=True,
        ),
        "lost_competitor": sa.Column("lost_competitor", sa.String(length=255), nullable=True),
    }

    for name, column in fields.items():
        if not _column_exists("leads", name):
            op.add_column("leads", column)

    op.execute("UPDATE leads SET last_activity = COALESCE(last_activity, created_at, now())")


def downgrade() -> None:
    for column in [
        "lost_competitor",
        "lost_reason",
        "attachments",
        "tags",
        "description",
        "next_action_note",
        "next_action_date",
        "next_action_type",
        "last_activity",
        "assigned_to",
        "marketing_campaign",
        "priority",
        "conversion_probability",
        "product_service",
        "currency",
        "deal_value",
        "contact_job_title",
        "company_website",
        "company_name",
        "contact_phone",
        "contact_email",
        "contact_name",
    ]:
        if _column_exists("leads", column):
            op.drop_column("leads", column)

    op.execute("DROP TYPE IF EXISTS lead_lost_reason")
    op.execute("DROP TYPE IF EXISTS lead_next_action_type")
    op.execute("DROP TYPE IF EXISTS lead_priority")
    op.execute("DROP TYPE IF EXISTS lead_currency")
