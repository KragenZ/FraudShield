from app.models import FraudAlert, Transaction
from conftest import make_tx


def payload(**kw):
    p = {"customer_id": "C1", "amount": 100.0, "transaction_type": "ONLINE_PURCHASE", "risk_score": 10}
    p.update(kw)
    return p


def test_risk_score_zero_preserved_approved_no_alert(client, db):
    r = client.post("/api/transactions", json=payload(risk_score=0))
    assert r.status_code == 201
    body = r.json()
    assert body["risk_score"] == 0
    assert body["fraud_probability"] == 0.0
    assert body["status"] == "APPROVED"

    db.expire_all()
    persisted = db.get(Transaction, body["id"])
    assert persisted is not None
    assert persisted.risk_score == 0
    assert persisted.fraud_probability == 0.0
    assert persisted.status == "APPROVED"
    assert db.query(FraudAlert).count() == 0


def test_omitted_risk_score_defaults_to_five(client, db):
    p = payload()
    del p["risk_score"]
    r = client.post("/api/transactions", json=p)
    assert r.status_code == 201
    body = r.json()
    assert body["risk_score"] == 5
    assert body["fraud_probability"] == 0.05
    assert body["status"] == "APPROVED"
    assert db.query(FraudAlert).count() == 0


def test_default_option_b_boundary_scores(client, db):
    cases = [
        (0, "APPROVED", None),
        (49, "APPROVED", None),
        (50, "UNDER_REVIEW", "MEDIUM"),
        (84, "UNDER_REVIEW", "MEDIUM"),
        (85, "FLAGGED", "CRITICAL"),
        (100, "FLAGGED", "CRITICAL"),
    ]
    for score, expected_status, expected_severity in cases:
        r = client.post("/api/transactions", json=payload(risk_score=score))
        assert r.status_code == 201, f"score={score}: {r.text}"
        body = r.json()
        assert body["risk_score"] == score
        assert body["status"] == expected_status
        alert = db.query(FraudAlert).filter(FraudAlert.transaction_id == body["id"]).one_or_none()
        if expected_severity is None:
            assert alert is None
        else:
            assert alert is not None
            assert alert.severity == expected_severity
            assert alert.risk_score == score


def test_auto_block_enabled_boundaries(client, db):
    assert client.put("/api/settings", json={"auto_block_high_risk": True}).status_code == 200
    cases = [
        (49, "APPROVED", None),
        (50, "UNDER_REVIEW", "MEDIUM"),
        (84, "UNDER_REVIEW", "MEDIUM"),
        (85, "BLOCKED", "CRITICAL"),
        (100, "BLOCKED", "CRITICAL"),
    ]
    for score, expected_status, expected_severity in cases:
        r = client.post("/api/transactions", json=payload(risk_score=score))
        assert r.status_code == 201
        body = r.json()
        assert body["status"] == expected_status
        alert = db.query(FraudAlert).filter(FraudAlert.transaction_id == body["id"]).one_or_none()
        if expected_severity is None:
            assert alert is None
        else:
            assert alert is not None and alert.severity == expected_severity


def test_policy_enforcement_anti_bypass(client, db):
    # Client cannot force BLOCKED or UNDER_REVIEW on a low-risk transaction
    r1 = client.post("/api/transactions", json=payload(risk_score=10, status="BLOCKED"))
    assert r1.status_code == 201
    assert r1.json()["status"] == "APPROVED"

    r2 = client.post("/api/transactions", json=payload(risk_score=10, status="UNDER_REVIEW"))
    assert r2.status_code == 201
    assert r2.json()["status"] == "APPROVED"

    # Client cannot bypass policy by sending APPROVED on medium/high-risk transactions
    r3 = client.post("/api/transactions", json=payload(risk_score=60, status="APPROVED"))
    assert r3.status_code == 201
    assert r3.json()["status"] == "UNDER_REVIEW"

    r4 = client.post("/api/transactions", json=payload(risk_score=90, status="APPROVED"))
    assert r4.status_code == 201
    assert r4.json()["status"] == "FLAGGED"

    alerts = {a.transaction_id: a.severity for a in db.query(FraudAlert).all()}
    assert alerts == {r3.json()["id"]: "MEDIUM", r4.json()["id"]: "CRITICAL"}


def test_heuristic_amount_bump_from_zero(client, db):
    r = client.post("/api/transactions", json=payload(risk_score=0, amount=20000.0))
    assert r.status_code == 201
    body = r.json()
    assert body["risk_score"] == 78
    assert body["fraud_probability"] == 0.78
    assert body["status"] == "UNDER_REVIEW"
    alert = db.query(FraudAlert).filter(FraudAlert.transaction_id == body["id"]).one()
    assert alert.severity == "MEDIUM"


def test_heuristic_location_bump(client, db):
    r = client.post("/api/transactions", json=payload(risk_score=0, location="Tor exit node"))
    assert r.status_code == 201
    body = r.json()
    assert body["risk_score"] == 88
    assert body["status"] == "FLAGGED"
    alert = db.query(FraudAlert).filter(FraudAlert.transaction_id == body["id"]).one()
    assert alert.severity == "CRITICAL"

    # With auto_block_high_risk=True, the same heuristic bump yields BLOCKED
    client.put("/api/settings", json={"auto_block_high_risk": True})
    r2 = client.post("/api/transactions", json=payload(risk_score=0, location="Tor exit node"))
    assert r2.status_code == 201
    assert r2.json()["risk_score"] == 88
    assert r2.json()["status"] == "BLOCKED"


def test_heuristic_crypto_high_amount_bump(client, db):
    r = client.post(
        "/api/transactions",
        json=payload(risk_score=5, amount=6000.0, transaction_type="CRYPTO_EXCHANGE"),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["risk_score"] == 82
    assert body["status"] == "UNDER_REVIEW"
    alert = db.query(FraudAlert).filter(FraudAlert.transaction_id == body["id"]).one()
    assert alert.severity == "MEDIUM"


def test_invalid_enum_and_range_rejected(client):
    assert client.post("/api/transactions", json=payload(transaction_type="BOGUS")).status_code == 422
    assert client.post("/api/transactions", json=payload(status="BOGUS")).status_code == 422
    assert client.post("/api/transactions", json=payload(amount=-5)).status_code == 422
    assert client.post("/api/transactions", json=payload(amount=0)).status_code == 422
    assert client.post("/api/transactions", json=payload(risk_score=-1)).status_code == 422
    assert client.post("/api/transactions", json=payload(risk_score=101)).status_code == 422


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
