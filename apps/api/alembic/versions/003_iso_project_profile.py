"""Add structured ISO profile fields on projects

Revision ID: 003
Revises: 002
Create Date: 2026-05-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return column in {c["name"] for c in inspect(bind).get_columns(table)}


def upgrade() -> None:
    iso_columns = {
        "iso_context": sa.Column("iso_context", sa.Text(), nullable=True),
        "iso_risk_register": sa.Column("iso_risk_register", sa.Text(), nullable=True),
        "iso_objectives": sa.Column("iso_objectives", sa.Text(), nullable=True),
        "iso_kpis": sa.Column("iso_kpis", sa.Text(), nullable=True),
        "iso_acceptance_criteria": sa.Column("iso_acceptance_criteria", sa.Text(), nullable=True),
        "iso_document_control": sa.Column(
            "iso_document_control", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        "iso_change_control": sa.Column(
            "iso_change_control", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
    }
    for name, column in iso_columns.items():
        if not _column_exists("projects", name):
            op.add_column("projects", column)


def downgrade() -> None:
    op.drop_column("projects", "iso_change_control")
    op.drop_column("projects", "iso_document_control")
    op.drop_column("projects", "iso_acceptance_criteria")
    op.drop_column("projects", "iso_kpis")
    op.drop_column("projects", "iso_objectives")
    op.drop_column("projects", "iso_risk_register")
    op.drop_column("projects", "iso_context")
