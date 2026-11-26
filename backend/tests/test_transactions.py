from app.models import Transaction, FraudAlert
from conftest import make_tx


def payload(**kw):
    p = {"customer_id": "C1", "amount": 100.0, "transaction_type": "ONLINE_PURCHASE", "risk_score": 10}
    p.update(kw)
    return p


def test_low_risk_approved_no_alert(client, db):
    r = client.post("/api/transactions", json=payload())
    assert r.status_code == 201
    assert r.json()["status"] == "APPROVED"
    assert db.query(FraudAlert).count() == 0


def test_explicit_status_kept_below_flag(client):
    r = client.post("/api/transactions", json=payload(status="UNDER_REVIEW"))
    assert r.json()["status"] == "UNDER_REVIEW"


def test_default_thresholds(client, db):
    assert client.post("/api/transactions", json=payload(risk_score=50)).json()["status"] == "FLAGGED"
    assert client.post("/api/transactions", json=payload(risk_score=84)).json()["status"] == "FLAGGED"
    assert client.post("/api/transactions", json=payload(risk_score=85)).json()["status"] == "BLOCKED"
    sev = {a.risk_score: a.severity for a in db.query(FraudAlert).all()}
    assert sev == {50: "HIGH", 84: "HIGH", 85: "CRITICAL"}


def test_heuristic_amount_bump(client):
    r = client.post("/api/transactions", json=payload(amount=20000.0))
    assert r.json()["risk_score"] == 78
    assert r.json()["status"] == "FLAGGED"


def test_heuristic_location_bump(client):
    r = client.post("/api/transactions", json=payload(location="Tor exit node"))
    assert r.json()["risk_score"] == 88
    assert r.json()["status"] == "BLOCKED"


def test_invalid_enum_rejected(client):
    assert client.post("/api/transactions", json=payload(transaction_type="BOGUS")).status_code == 422
    assert client.post("/api/transactions", json=payload(status="BOGUS")).status_code == 422
    assert client.post("/api/transactions", json=payload(amount=-5)).status_code == 422
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
