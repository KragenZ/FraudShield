from types import SimpleNamespace

import pytest

from app.models import FraudAlert, Transaction
from app.scoring import (
    classify_transaction,
    compute_heuristic_risk_score,
    compute_synthetic_probability,
)
from conftest import make_tx


def payload(**kw):
    p = {"customer_id": "C1", "amount": 100.0, "transaction_type": "ONLINE_PURCHASE"}
    p.update(kw)
    return p


def test_public_caller_cannot_inject_risk_score_or_status(client, db):
    """Public POST /api/transactions must ignore client-supplied risk_score/status/fraud_probability."""
    for injected in (
        {"risk_score": 0},
        {"risk_score": 95},
        {"risk_score": 100},
        {"status": "BLOCKED"},
        {"status": "FLAGGED", "risk_score": 99, "fraud_probability": 0.99},
    ):
        r = client.post("/api/transactions", json=payload(**injected))
        assert r.status_code == 201, f"injected={injected}: {r.text}"
        body = r.json()
        assert body["risk_score"] == 5
        assert body["fraud_probability"] == 0.05
        assert body["status"] == "APPROVED"

    db.expire_all()
    assert db.query(Transaction).count() == 5
    assert db.query(FraudAlert).count() == 0


def test_public_caller_cannot_bypass_heuristics_with_risk_score_zero(client, db):
    r_amt = client.post("/api/transactions", json=payload(risk_score=0, amount=20000.0))
    assert r_amt.status_code == 201
    b_amt = r_amt.json()
    assert b_amt["risk_score"] == 78
    assert b_amt["fraud_probability"] == 0.78
    assert b_amt["status"] == "UNDER_REVIEW"
    alert_amt = db.query(FraudAlert).filter(FraudAlert.transaction_id == b_amt["id"]).one()
    assert alert_amt.severity == "MEDIUM"
    assert "medium-risk" in alert_amt.reason.lower()

    r_tor = client.post("/api/transactions", json=payload(risk_score=0, location="Tor exit node"))
    assert r_tor.status_code == 201
    b_tor = r_tor.json()
    assert b_tor["risk_score"] == 88
    assert b_tor["fraud_probability"] == 0.88
    assert b_tor["status"] == "FLAGGED"
    alert_tor = db.query(FraudAlert).filter(FraudAlert.transaction_id == b_tor["id"]).one()
    assert alert_tor.severity == "CRITICAL"
    assert "high-risk" in alert_tor.reason.lower()
    assert "urgent" in alert_tor.reason.lower()


def test_omitted_fields_default_score_five(client, db):
    r = client.post("/api/transactions", json=payload())
    assert r.status_code == 201
    body = r.json()
    assert body["risk_score"] == 5
    assert body["fraud_probability"] == 0.05
    assert body["status"] == "APPROVED"
    assert db.query(FraudAlert).count() == 0


def test_heuristic_location_bump_respects_auto_block(client, db):
    r1 = client.post("/api/transactions", json=payload(location="Tor exit node"))
    assert r1.status_code == 201
    assert r1.json()["risk_score"] == 88
    assert r1.json()["status"] == "FLAGGED"

    client.put("/api/settings", json={"auto_block_high_risk": True})
    r2 = client.post("/api/transactions", json=payload(location="Tor exit node"))
    assert r2.status_code == 201
    assert r2.json()["risk_score"] == 88
    assert r2.json()["status"] == "BLOCKED"
    alert2 = db.query(FraudAlert).filter(FraudAlert.transaction_id == r2.json()["id"]).one()
    assert alert2.severity == "CRITICAL"


def test_heuristic_crypto_high_amount_bump(client, db):
    r = client.post(
        "/api/transactions",
        json=payload(amount=6000.0, transaction_type="CRYPTO_EXCHANGE"),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["risk_score"] == 82
    assert body["status"] == "UNDER_REVIEW"
    alert = db.query(FraudAlert).filter(FraudAlert.transaction_id == body["id"]).one()
    assert alert.severity == "MEDIUM"


def test_internal_compute_heuristic_risk_score_preserves_explicit_zero():
    # Explicit base_score=0 stays 0 for normal transactions in internal workflows
    assert compute_heuristic_risk_score(100.0, "ONLINE_PURCHASE", "New York", base_score=0) == 0
    assert compute_synthetic_probability(0) == 0.0
    # None defaults to 5
    assert compute_heuristic_risk_score(100.0, "ONLINE_PURCHASE", "New York", base_score=None) == 5
    # Heuristic floors still apply over explicit base_score=0
    assert compute_heuristic_risk_score(20000.0, "ONLINE_PURCHASE", "New York", base_score=0) == 78
    assert compute_heuristic_risk_score(100.0, "ONLINE_PURCHASE", "Tor exit node", base_score=0) == 88
    assert compute_heuristic_risk_score(6000.0, "CRYPTO_EXCHANGE", "New York", base_score=0) == 82
    assert compute_heuristic_risk_score(6000.0, "WIRE_TRANSFER", "New York", base_score=0) == 82


@pytest.mark.parametrize(
    "auto_block,expected_high",
    [(False, "FLAGGED"), (True, "BLOCKED")],
)
def test_classify_transaction_default_option_b_boundaries(auto_block, expected_high):
    cfg = SimpleNamespace(flag_threshold=50, block_threshold=85, auto_block_high_risk=auto_block)
    cases = [
        (0, "APPROVED", None),
        (49, "APPROVED", None),
        (50, "UNDER_REVIEW", "MEDIUM"),
        (84, "UNDER_REVIEW", "MEDIUM"),
        (85, expected_high, "CRITICAL"),
        (100, expected_high, "CRITICAL"),
    ]
    for score, exp_status, exp_sev in cases:
        assert classify_transaction(score, cfg) == (exp_status, exp_sev)


@pytest.mark.parametrize(
    "auto_block,expected_high",
    [(False, "FLAGGED"), (True, "BLOCKED")],
)
def test_classify_transaction_custom_threshold_boundaries(auto_block, expected_high):
    cfg = SimpleNamespace(flag_threshold=30, block_threshold=70, auto_block_high_risk=auto_block)
    cases = [
        (29, "APPROVED", None),
        (30, "UNDER_REVIEW", "MEDIUM"),
        (69, "UNDER_REVIEW", "MEDIUM"),
        (70, expected_high, "CRITICAL"),
    ]
    for score, exp_status, exp_sev in cases:
        assert classify_transaction(score, cfg) == (exp_status, exp_sev)


def test_invalid_enum_and_range_rejected(client):
    assert client.post("/api/transactions", json=payload(transaction_type="BOGUS")).status_code == 422
    assert client.post("/api/transactions", json=payload(amount=-5)).status_code == 422
    assert client.post("/api/transactions", json=payload(amount=0)).status_code == 422


def test_get_detail_and_404(client):
    tid = client.post("/api/transactions", json=payload()).json()["id"]
    assert client.get(f"/api/transactions/{tid}").status_code == 200
    assert client.get("/api/transactions/NOPE").status_code == 404


def test_like_wildcards_are_escaped(client, db):
    make_tx(db, id="TX-A", merchant="Alpha")
    make_tx(db, id="TX-B", merchant="100%_off")
    make_tx(db, id="TX-C", merchant="Gamma")

    # '%' alone must not match everything
    r = client.get("/api/transactions", params={"search": "%"})
    assert [t["id"] for t in r.json()["transactions"]] == ["TX-B"]
    # '_' must not act as single-char wildcard
    r = client.get("/api/transactions", params={"search": "TX-_"})
    assert r.json()["total"] == 0
    r = client.get("/api/transactions", params={"search": "%%%%"})
    assert r.json()["total"] == 0
    # normal search still works
    r = client.get("/api/transactions", params={"search": "alph"})
    assert [t["id"] for t in r.json()["transactions"]] == ["TX-A"]
