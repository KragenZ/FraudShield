import random

from app.models import FraudAlert, ModelPerformanceRecord, SystemSetting, Transaction
from app.scoring import classify_transaction, compute_synthetic_probability
from app.seed import seed_database
from app.settings_service import get_settings
from app.simulator import generate_simulated_transaction


class _FixedRng:
    """Deterministic RNG stub that validates the selected risk band."""

    def __init__(self, roll: float, score: int, amount: float = 250.0):
        self._roll = roll
        self._score = score
        self._amount = amount

    def choice(self, seq):
        return seq[0]

    def random(self):
        return self._roll

    def randint(self, a: int, b: int) -> int:
        assert a <= self._score <= b, f"score {self._score} outside [{a}, {b}]"
        return self._score

    def uniform(self, a: float, b: float) -> float:
        return self._amount


def test_simulator_obeys_default_option_b_policy(db):
    # Low risk -> APPROVED, no alert
    tx_low, alert_low = generate_simulated_transaction(db, rng=_FixedRng(0.80, 20, 120.0))
    assert tx_low.risk_score == 20
    assert tx_low.fraud_probability == 0.2
    assert tx_low.status == "APPROVED"
    assert alert_low is None

    # Medium risk -> UNDER_REVIEW + MEDIUM alert
    tx_med, alert_med = generate_simulated_transaction(db, rng=_FixedRng(0.20, 65, 1200.0))
    assert tx_med.risk_score == 65
    assert tx_med.fraud_probability == 0.65
    assert tx_med.status == "UNDER_REVIEW"
    assert alert_med is not None
    assert alert_med.transaction_id == tx_med.id
    assert alert_med.severity == "MEDIUM"
    assert alert_med.risk_score == 65

    # High risk with default auto_block_high_risk=False -> FLAGGED + CRITICAL alert (not BLOCKED)
    tx_high, alert_high = generate_simulated_transaction(db, rng=_FixedRng(0.05, 90, 9500.0))
    assert tx_high.risk_score == 90
    assert tx_high.fraud_probability == 0.9
    assert tx_high.status == "FLAGGED"
    assert alert_high is not None
    assert alert_high.transaction_id == tx_high.id
    assert alert_high.severity == "CRITICAL"
    assert alert_high.risk_score == 90


def test_simulator_updates_live_when_settings_change(client, db):
    # Ensure default row exists, then verify live update via API
    r = client.put(
        "/api/settings",
        json={"flag_threshold": 15, "block_threshold": 60, "auto_block_high_risk": True},
    )
    assert r.status_code == 200
    db.expire_all()

    tx_still_low, alert_still_low = generate_simulated_transaction(db, rng=_FixedRng(0.80, 10, 50.0))
    assert tx_still_low.status == "APPROVED"
    assert alert_still_low is None

    # Score 20 (from low band) crosses lowered flag_threshold=15 -> UNDER_REVIEW + MEDIUM
    tx_now_med, alert_now_med = generate_simulated_transaction(db, rng=_FixedRng(0.80, 20, 200.0))
    assert tx_now_med.status == "UNDER_REVIEW"
    assert alert_now_med is not None and alert_now_med.severity == "MEDIUM"

    # Score 65 (from medium band) crosses lowered block_threshold=60 with auto_block=True -> BLOCKED + CRITICAL
    tx_now_high, alert_now_high = generate_simulated_transaction(db, rng=_FixedRng(0.20, 65, 2500.0))
    assert tx_now_high.status == "BLOCKED"
    assert alert_now_high is not None and alert_now_high.severity == "CRITICAL"

    # Turning auto_block_high_risk back off immediately switches high scores to FLAGGED
    assert client.put("/api/settings", json={"auto_block_high_risk": False}).status_code == 200
    db.expire_all()
    tx_flagged, alert_flagged = generate_simulated_transaction(db, rng=_FixedRng(0.05, 92, 12000.0))
    assert tx_flagged.status == "FLAGGED"
    assert alert_flagged is not None and alert_flagged.severity == "CRITICAL"


def test_seed_database_consistency_with_default_policy(db, monkeypatch):
    seeded_rng = random.Random(42)
    monkeypatch.setattr("app.seed.random", seeded_rng)

    seed_database(db, force=False)

    transactions = db.query(Transaction).all()
    alerts = db.query(FraudAlert).all()
    assert len(transactions) == 50
    assert db.query(ModelPerformanceRecord).count() == 1

    cfg = get_settings(db)
    assert cfg.auto_block_high_risk is False

    alerts_by_tx = {a.transaction_id: a for a in alerts}
    assert len(alerts_by_tx) == len(alerts)

    for tx in transactions:
        expected_status, expected_sev = classify_transaction(tx.risk_score, cfg)
        assert tx.status == expected_status
        assert tx.fraud_probability == compute_synthetic_probability(tx.risk_score)
        assert tx.status != "BLOCKED"

        if tx.risk_score >= 50:
            assert tx.status != "APPROVED"
            assert tx.id in alerts_by_tx
            assert alerts_by_tx[tx.id].severity == expected_sev
            assert alerts_by_tx[tx.id].risk_score == tx.risk_score
        else:
            assert tx.status == "APPROVED"
            assert tx.id not in alerts_by_tx

    # Idempotent when called again with force=False
    seed_database(db, force=False)
    assert db.query(Transaction).count() == 50


def test_seed_database_respects_auto_block_enabled(db, monkeypatch):
    db.add(
        SystemSetting(
            id=1,
            flag_threshold=50,
            block_threshold=85,
            auto_block_high_risk=True,
            email_alerts=False,
        )
    )
    db.commit()

    seeded_rng = random.Random(42)
    monkeypatch.setattr("app.seed.random", seeded_rng)
    seed_database(db, force=True)

    cfg = get_settings(db)
    assert cfg.auto_block_high_risk is True
    transactions = db.query(Transaction).all()
    alerts_by_tx = {a.transaction_id: a for a in db.query(FraudAlert).all()}

    high_risk_txs = [tx for tx in transactions if tx.risk_score >= 85]
    assert len(high_risk_txs) > 0
    for tx in transactions:
        expected_status, expected_sev = classify_transaction(tx.risk_score, cfg)
        assert tx.status == expected_status
        if expected_sev is None:
            assert tx.id not in alerts_by_tx
        else:
            assert alerts_by_tx[tx.id].severity == expected_sev
