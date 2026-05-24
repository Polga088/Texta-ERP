"""Add task module advanced fields

Revision ID: 006
Revises: 005
Create Date: 2026-05-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return column in {c["name"] for c in inspect(bind).get_columns(table)}


def _safe_add_task_enum_values() -> None:
    op.execute(sa.text("ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'blocked'"))
    op.execute(sa.text("ALTER TYPE task_priority ADD VALUE IF NOT EXISTS 'critical'"))


def upgrade() -> None:
    _safe_add_task_enum_values()
    columns = {
        "task_code": sa.Column("task_code", sa.String(length=50), nullable=True),
        "reviewer_id": sa.Column(
            "reviewer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        "start_date": sa.Column("start_date", sa.Date(), nullable=True),
        "actual_start_date": sa.Column("actual_start_date", sa.Date(), nullable=True),
        "actual_end_date": sa.Column("actual_end_date", sa.Date(), nullable=True),
        "duration_days": sa.Column("duration_days", sa.Integer(), nullable=True),
        "delay_days": sa.Column("delay_days", sa.Integer(), nullable=True),
        "completion_percentage": sa.Column("completion_percentage", sa.Integer(), nullable=False, server_default="0"),
        "estimated_hours": sa.Column("estimated_hours", sa.Numeric(10, 2), nullable=False, server_default="0"),
        "actual_hours": sa.Column("actual_hours", sa.Numeric(10, 2), nullable=False, server_default="0"),
        "billable": sa.Column("billable", sa.Boolean(), nullable=False, server_default=sa.false()),
        "hourly_rate": sa.Column("hourly_rate", sa.Numeric(10, 2), nullable=True),
        "tags": sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        "category": sa.Column("category", sa.String(length=100), nullable=True),
        "milestone": sa.Column("milestone", sa.String(length=120), nullable=True),
        "attachments": sa.Column(
            "attachments", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"
        ),
        "comments": sa.Column("comments", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        "checklist": sa.Column(
            "checklist", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"
        ),
        "block_reason": sa.Column("block_reason", sa.Text(), nullable=True),
        "blocked_since": sa.Column("blocked_since", sa.DateTime(timezone=True), nullable=True),
        "blocked_by": sa.Column(
            "blocked_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        "unblocked_at": sa.Column("unblocked_at", sa.DateTime(timezone=True), nullable=True),
        "unblock_note": sa.Column("unblock_note", sa.Text(), nullable=True),
    }
    for name, column in columns.items():
        if not _column_exists("tasks", name):
            op.add_column("tasks", column)


def downgrade() -> None:
    for column in [
        "unblock_note",
        "unblocked_at",
        "blocked_by",
        "blocked_since",
        "block_reason",
        "checklist",
        "comments",
        "attachments",
        "milestone",
        "category",
        "tags",
        "hourly_rate",
        "billable",
        "actual_hours",
        "estimated_hours",
        "completion_percentage",
        "delay_days",
        "duration_days",
        "actual_end_date",
        "actual_start_date",
        "start_date",
        "reviewer_id",
        "task_code",
    ]:
        if _column_exists("tasks", column):
            op.drop_column("tasks", column)
