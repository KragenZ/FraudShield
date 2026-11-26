from app.models import SystemSetting, Transaction, FraudAlert
from app.settings_service import get_settings


def tx_payload(**kw):
    p = {"customer_id": "C1", "amount": 100.0, "transaction_type": "ONLINE_PURCHASE", "risk_score": 10}
    p.update(kw)
    return p


def test_defaults_created(client, db):
    r = client.get("/api/settings")
    assert r.status_code == 200
    body = r.json()
    assert body["flag_threshold"] == 50
    assert body["block_threshold"] == 85
    assert body["auto_block_high_risk"] is True
    assert body["email_alerts"] is False
    assert db.query(SystemSetting).count() == 1


def test_put_persists_and_sets_updated_at(client):
    r = client.put("/api/settings", json={
        "flag_threshold": 30, "block_threshold": 70,
        "auto_block_high_risk": False, "email_alerts": True, "updated_by": "alice",
    })
    assert r.status_code == 200
    body = r.json()
    assert (body["flag_threshold"], body["block_threshold"]) == (30, 70)
    assert body["auto_block_high_risk"] is False and body["email_alerts"] is True
    assert body["updated_by"] == "alice" and body["updated_at"]
    assert client.get("/api/settings").json()["flag_threshold"] == 30


def test_persistence_across_sessions(client, session_factory):
    client.put("/api/settings", json={"flag_threshold": 11, "block_threshold": 22})
    s = session_factory()
    try:
        cfg = get_settings(s)
        assert (cfg.flag_threshold, cfg.block_threshold) == (11, 22)
    finally:
        s.close()


def test_partial_update_keeps_other_fields(client):
    client.put("/api/settings", json={"flag_threshold": 30, "block_threshold": 70})
    r = client.put("/api/settings", json={"email_alerts": True})
    assert r.status_code == 200
    assert r.json()["flag_threshold"] == 30 and r.json()["block_threshold"] == 70
    assert r.json()["email_alerts"] is True


def test_validation_flag_not_below_block(client):
    assert client.put("/api/settings", json={"flag_threshold": 80, "block_threshold": 80}).status_code == 422
    assert client.put("/api/settings", json={"flag_threshold": 90, "block_threshold": 10}).status_code == 422


def test_validation_range_and_types(client):
    assert client.put("/api/settings", json={"flag_threshold": -1}).status_code == 422
    assert client.put("/api/settings", json={"block_threshold": 101}).status_code == 422
    assert client.put("/api/settings", json={"flag_threshold": "abc"}).status_code == 422


def test_partial_update_validates_merged_result(client):
    # defaults 50/85; raising flag above stored block must fail
    assert client.put("/api/settings", json={"flag_threshold": 90}).status_code == 422
    # lowering block below stored flag must fail
    assert client.put("/api/settings", json={"block_threshold": 40}).status_code == 422
    # nothing was persisted
    body = client.get("/api/settings").json()
    assert (body["flag_threshold"], body["block_threshold"]) == (50, 85)


def test_invalid_stored_row_falls_back_to_defaults(client, db, caplog):
    db.add(SystemSetting(id=1, flag_threshold=90, block_threshold=10))
    db.commit()
    with caplog.at_level("WARNING", logger="fraudshield.settings"):
        r = client.get("/api/settings")
    assert r.status_code == 200
    assert (r.json()["flag_threshold"], r.json()["block_threshold"]) == (50, 85)
    assert any("Invalid stored thresholds" in m for m in caplog.messages)


def test_out_of_range_stored_row_falls_back(client, db):
    db.add(SystemSetting(id=1, flag_threshold=10, block_threshold=150))
    db.commit()
    body = client.get("/api/settings").json()
    assert (body["flag_threshold"], body["block_threshold"]) == (50, 85)


def test_put_repairs_invalid_stored_row(client, db):
    db.add(SystemSetting(id=1, flag_threshold=90, block_threshold=10))
    db.commit()
    assert client.put("/api/settings", json={"email_alerts": True}).status_code == 200
    db.expire_all()
    row = db.get(SystemSetting, 1)
    assert (row.flag_threshold, row.block_threshold) == (50, 85)


def test_get_settings_never_raises(db):
    db.close()
    db.bind.dispose  # session still usable; just make sure no exception
    assert get_settings(db).flag_threshold == 50


def test_scoring_changes_with_thresholds(client, db):
    r = client.post("/api/transactions", json=tx_payload(risk_score=25))
    assert r.json()["status"] == "APPROVED"
    assert db.query(FraudAlert).count() == 0

    client.put("/api/settings", json={"flag_threshold": 20, "block_threshold": 40})
    r = client.post("/api/transactions", json=tx_payload(risk_score=25))
    assert r.json()["status"] == "FLAGGED"
    r = client.post("/api/transactions", json=tx_payload(risk_score=45))
    assert r.json()["status"] == "BLOCKED"
    sev = {a.risk_score: a.severity for a in db.query(FraudAlert).all()}
    assert sev == {25: "HIGH", 45: "CRITICAL"}


def test_auto_block_off_flags_instead(client, db):
    client.put("/api/settings", json={"auto_block_high_risk": False})
    r = client.post("/api/transactions", json=tx_payload(risk_score=95))
    assert r.json()["status"] == "FLAGGED"
    assert db.query(FraudAlert).one().severity == "CRITICAL"


def test_strict_types_and_null_rejected(client):
    for body in ({"flag_threshold": True}, {"flag_threshold": 50.5}, {"flag_threshold": "50"},
                 {"email_alerts": "yes"}, {"flag_threshold": None}, {}):
        assert client.put("/api/settings", json=body).status_code == 422, body
