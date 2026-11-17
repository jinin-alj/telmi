"""add drawing reads and unique turn positions

Revision ID: da4fdbf40629
Revises: 3fac59665f27
Create Date: 2026-11-17 16:01:44.378444

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "da4fdbf40629"
down_revision: str | Sequence[str] | None = "3fac59665f27"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_unique_constraint(
        "uq_session_turns_session_id_position", "session_turns", ["session_id", "position"]
    )
    op.add_column(
        "study_sessions",
        sa.Column("drawing_reads", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("study_sessions", "drawing_reads")
    op.drop_constraint("uq_session_turns_session_id_position", "session_turns", type_="unique")
