"""record how each turn was given

Revision ID: 3f37cd39b1a5
Revises: 647d0ac1470d
Create Date: 2026-11-17 18:42:06.448906

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3f37cd39b1a5"
down_revision: str | Sequence[str] | None = "647d0ac1470d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("session_turns", sa.Column("input_mode", sa.String(length=10), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("session_turns", "input_mode")
