"""Add structured ISO profile fields on projects

Revision ID: 003
Revises: 002
Create Date: 2026-05-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("iso_context", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("iso_risk_register", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("iso_objectives", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("iso_kpis", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("iso_acceptance_criteria", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("iso_document_control", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("projects", sa.Column("iso_change_control", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column("projects", "iso_change_control")
    op.drop_column("projects", "iso_document_control")
    op.drop_column("projects", "iso_acceptance_criteria")
    op.drop_column("projects", "iso_kpis")
    op.drop_column("projects", "iso_objectives")
    op.drop_column("projects", "iso_risk_register")
    op.drop_column("projects", "iso_context")
