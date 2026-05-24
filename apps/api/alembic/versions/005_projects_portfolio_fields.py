"""Add project portfolio fields and enums

Revision ID: 005
Revises: 004
Create Date: 2026-05-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return column in {c["name"] for c in inspect(bind).get_columns(table)}


def _safe_add_project_status_values() -> None:
    for value in ["draft", "planning", "in_progress", "in_review", "done"]:
        op.execute(sa.text(f"ALTER TYPE project_status ADD VALUE IF NOT EXISTS '{value}'"))


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
    _safe_add_project_status_values()
    _create_enum("project_type", ["internal", "client", "partnership", "rnd", "marketing", "event"])
    _create_enum("project_priority", ["critical", "high", "medium", "low"])
    _create_enum("project_visibility", ["public", "private", "restricted"])
    _create_enum("project_health_status", ["good", "watch", "danger", "not_evaluated"])

    columns = {
        "client_lead_id": sa.Column(
            "client_lead_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="SET NULL"),
            nullable=True,
        ),
        "project_type": sa.Column(
            "project_type",
            postgresql.ENUM("internal", "client", "partnership", "rnd", "marketing", "event", name="project_type", create_type=False),
            nullable=False,
            server_default="internal",
        ),
        "category": sa.Column("category", sa.String(length=120), nullable=True),
        "budget_consumed": sa.Column("budget_consumed", sa.Numeric(14, 2), nullable=False, server_default="0"),
        "budget_remaining": sa.Column("budget_remaining", sa.Numeric(14, 2), nullable=False, server_default="0"),
        "budget_alert_threshold": sa.Column("budget_alert_threshold", sa.Integer(), nullable=False, server_default="80"),
        "currency": sa.Column("currency", sa.String(length=10), nullable=False, server_default="MAD"),
        "hourly_rate": sa.Column("hourly_rate", sa.Numeric(12, 2), nullable=True),
        "actual_start_date": sa.Column("actual_start_date", sa.Date(), nullable=True),
        "actual_end_date": sa.Column("actual_end_date", sa.Date(), nullable=True),
        "duration_days": sa.Column("duration_days", sa.Integer(), nullable=True),
        "delay_days": sa.Column("delay_days", sa.Integer(), nullable=True),
        "project_manager_id": sa.Column(
            "project_manager_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        "team_members": sa.Column("team_members", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        "priority": sa.Column(
            "priority",
            postgresql.ENUM("critical", "high", "medium", "low", name="project_priority", create_type=False),
            nullable=False,
            server_default="medium",
        ),
        "tags": sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        "visibility": sa.Column(
            "visibility",
            postgresql.ENUM("public", "private", "restricted", name="project_visibility", create_type=False),
            nullable=False,
            server_default="private",
        ),
        "deliverables": sa.Column(
            "deliverables", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"
        ),
        "project_documents": sa.Column(
            "project_documents", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"
        ),
        "notes": sa.Column("notes", sa.Text(), nullable=True),
        "completion_percentage": sa.Column("completion_percentage", sa.Integer(), nullable=False, server_default="0"),
        "health_status": sa.Column(
            "health_status",
            postgresql.ENUM("good", "watch", "danger", "not_evaluated", name="project_health_status", create_type=False),
            nullable=False,
            server_default="not_evaluated",
        ),
        "pause_reason": sa.Column("pause_reason", sa.Text(), nullable=True),
        "cancel_reason": sa.Column("cancel_reason", sa.Text(), nullable=True),
    }

    for name, column in columns.items():
        if not _column_exists("projects", name):
            op.add_column("projects", column)

    op.execute("UPDATE projects SET project_manager_id = COALESCE(project_manager_id, owner_id)")
    op.execute("UPDATE projects SET budget_remaining = COALESCE(budget, 0) - COALESCE(budget_consumed, 0)")


def downgrade() -> None:
    for column in [
        "cancel_reason",
        "pause_reason",
        "health_status",
        "completion_percentage",
        "notes",
        "project_documents",
        "deliverables",
        "visibility",
        "tags",
        "priority",
        "team_members",
        "project_manager_id",
        "delay_days",
        "duration_days",
        "actual_end_date",
        "actual_start_date",
        "hourly_rate",
        "currency",
        "budget_alert_threshold",
        "budget_remaining",
        "budget_consumed",
        "category",
        "project_type",
        "client_lead_id",
    ]:
        if _column_exists("projects", column):
            op.drop_column("projects", column)
