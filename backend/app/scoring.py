"""Centralized Phase 1 heuristic scoring and Option B classification policy."""
from typing import Optional, Tuple

from app.models import AlertSeverity, TransactionStatus


def compute_heuristic_risk_score(
    amount: float,
    transaction_type: str,
    location: Optional[str] = None,
    base_score: Optional[int] = None,
) -> int:
    """Compute a bounded (0-100) Phase 1 heuristic risk score.

    Preserves explicit ``base_score=0`` while defaulting ``None`` to ``5``,
    then applies server-side minimum risk floors for high-risk patterns.
    """
    score = base_score if base_score is not None else 5

    if amount > 10000:
        score = max(score, 78)
    loc = location or ""
    if "Tor" in loc or "Unknown" in loc:
        score = max(score, 88)
    if transaction_type in ("CRYPTO_EXCHANGE", "WIRE_TRANSFER") and amount > 5000:
        score = max(score, 82)

    return max(0, min(100, int(score)))


def compute_synthetic_probability(risk_score: int) -> float:
    """Return a Phase 1 synthetic/baseline heuristic index in [0.0, 1.0].

    Note: This is a Phase 1 heuristic index derived linearly from ``risk_score``,
    NOT a statistically calibrated posterior fraud probability.
    """
    return round(risk_score / 100.0, 3)


def classify_transaction(risk_score: int, cfg) -> Tuple[str, Optional[str]]:
    """Apply the authoritative Option B decision policy for a risk score.

    Returns ``(transaction_status, alert_severity_or_none)``:
    - ``risk_score >= cfg.block_threshold`` (default 85-100): ``BLOCKED`` when
      ``cfg.auto_block_high_risk`` is truthy else ``FLAGGED``, with ``CRITICAL`` alert.
    - ``risk_score >= cfg.flag_threshold`` (default 50-84): ``UNDER_REVIEW`` with
      ``MEDIUM`` alert.
    - Below ``cfg.flag_threshold`` (default 0-49): ``APPROVED`` with no alert.
    """
    if risk_score >= cfg.block_threshold:
        tx_status = (
            TransactionStatus.BLOCKED.value
            if bool(cfg.auto_block_high_risk)
            else TransactionStatus.FLAGGED.value
        )
        return tx_status, AlertSeverity.CRITICAL.value
    if risk_score >= cfg.flag_threshold:
        return TransactionStatus.UNDER_REVIEW.value, AlertSeverity.MEDIUM.value
    return TransactionStatus.APPROVED.value, None
