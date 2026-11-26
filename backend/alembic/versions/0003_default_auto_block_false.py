"""default system_settings.auto_block_high_risk to false

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-26 10:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Set server default for system_settings.auto_block_high_risk to false."""
    with op.batch_alter_table('system_settings') as batch_op:
        batch_op.alter_column(
            'auto_block_high_risk',
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        )


def downgrade() -> None:
    """Restore server default for system_settings.auto_block_high_risk to true."""
    with op.batch_alter_table('system_settings') as batch_op:
        batch_op.alter_column(
            'auto_block_high_risk',
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        )
