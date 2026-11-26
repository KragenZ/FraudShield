"""Persistent fraud-engine settings and the shared scoring decision logic."""
import logging
from dataclasses import dataclass
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.models import SystemSetting, TransactionStatus, AlertSeverity

logger = logging.getLogger("fraudshield.settings")

DEFAULT_FLAG_THRESHOLD = 50
DEFAULT_BLOCK_THRESHOLD = 85
SETTINGS_ROW_ID = 1


@dataclass(frozen=True)
class EffectiveSettings:
    flag_threshold: int = DEFAULT_FLAG_THRESHOLD
    block_threshold: int = DEFAULT_BLOCK_THRESHOLD
    auto_block_high_risk: bool = True
    email_alerts: bool = False


def thresholds_valid(flag, block) -> bool:
    return (
        isinstance(flag, int) and isinstance(block, int)
        and 0 <= flag <= 100 and 0 <= block <= 100 and flag < block
    )


def get_settings(db: Session) -> SystemSetting:
    """Return the settings row (id=1), creating defaults when missing.

    Never raises: on any error or invalid stored thresholds, a transient object
    carrying defaults is returned (the invalid row is not modified).
    """
    try:
        row = db.get(SystemSetting, SETTINGS_ROW_ID)
        if row is None:
            row = SystemSetting(
                id=SETTINGS_ROW_ID,
                flag_threshold=DEFAULT_FLAG_THRESHOLD,
                block_threshold=DEFAULT_BLOCK_THRESHOLD,
                auto_block_high_risk=True,
                email_alerts=False,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
        if not thresholds_valid(row.flag_threshold, row.block_threshold):
            logger.warning(
                "Invalid stored thresholds (flag=%r, block=%r); falling back to defaults %d/%d",
                row.flag_threshold, row.block_threshold, DEFAULT_FLAG_THRESHOLD, DEFAULT_BLOCK_THRESHOLD,
            )
            return SystemSetting(
                id=SETTINGS_ROW_ID,
                flag_threshold=DEFAULT_FLAG_THRESHOLD,
                block_threshold=DEFAULT_BLOCK_THRESHOLD,
                auto_block_high_risk=bool(row.auto_block_high_risk),
                email_alerts=bool(row.email_alerts),
                updated_at=row.updated_at,
                updated_by=row.updated_by,
            )
        return row
    except Exception:  # noqa: BLE001 - contract: never raise
        logger.warning("Could not load settings; using defaults", exc_info=True)
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass
        return SystemSetting(
            id=SETTINGS_ROW_ID,
            flag_threshold=DEFAULT_FLAG_THRESHOLD,
            block_threshold=DEFAULT_BLOCK_THRESHOLD,
            auto_block_high_risk=True,
            email_alerts=False,
        )


def decide(risk_score: int, cfg, explicit_status: Optional[str] = None) -> Tuple[str, Optional[str]]:
    """Return (transaction_status, alert_severity or None) for a risk score."""
    if risk_score >= cfg.block_threshold:
        status = TransactionStatus.BLOCKED.value if cfg.auto_block_high_risk else TransactionStatus.FLAGGED.value
        return status, AlertSeverity.CRITICAL.value
    if risk_score >= cfg.flag_threshold:
        return TransactionStatus.FLAGGED.value, AlertSeverity.HIGH.value
    return (explicit_status or TransactionStatus.APPROVED.value), None
