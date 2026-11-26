import pytest

from app.models import FraudAlert, SystemSetting, Transaction
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
    assert body["auto_block_high_risk"] is False
    assert body["email_alerts"] is False
    assert db.query(SystemSetting).count() == 1


def test_missing_row_creation_via_service_defaults_auto_block_false(db):
    assert db.query(SystemSetting).count() == 0
    cfg = get_settings(db)
    assert cfg.id == 1
    assert cfg.flag_threshold == 50
    assert cfg.block_threshold == 85
    assert cfg.auto_block_high_risk is False
    assert cfg.email_alerts is False
    assert db.query(SystemSetting).count() == 1


def test_put_persists_and_sets_updated_at(client):
    r = client.put("/api/settings", json={
        "flag_threshold": 30, "block_threshold": 70,
        "auto_block_high_risk": True, "email_alerts": True, "updated_by": "alice",
    })
    assert r.status_code == 200
    body = r.json()
    assert (body["flag_threshold"], body["block_threshold"]) == (30, 70)
    assert body["auto_block_high_risk"] is True and body["email_alerts"] is True
    assert body["updated_by"] == "alice" and body["updated_at"]
    fetched = client.get("/api/settings").json()
    assert fetched["flag_threshold"] == 30
    assert fetched["auto_block_high_risk"] is True


def test_persistence_across_sessions(client, session_factory):
    client.put("/api/settings", json={"flag_threshold": 11, "block_threshold": 22, "auto_block_high_risk": True})
    s = session_factory()
    try:
        cfg = get_settings(s)
        assert (cfg.flag_threshold, cfg.block_threshold) == (11, 22)
        assert cfg.auto_block_high_risk is True
    finally:
        s.close()


def test_partial_update_keeps_other_fields(client):
    client.put("/api/settings", json={"flag_threshold": 30, "block_threshold": 70, "auto_block_high_risk": True})
    r = client.put("/api/settings", json={"email_alerts": True})
    assert r.status_code == 200
    body = r.json()
    assert body["flag_threshold"] == 30 and body["block_threshold"] == 70
    assert body["auto_block_high_risk"] is True
    assert body["email_alerts"] is True


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
    assert body["auto_block_high_risk"] is False


def test_invalid_stored_row_falls_back_to_defaults(client, db, caplog):
    db.add(SystemSetting(id=1, flag_threshold=90, block_threshold=10))
    db.commit()
    with caplog.at_level("WARNING", logger="fraudshield.settings"):
        r = client.get("/api/settings")
    assert r.status_code == 200
    body = r.json()
    assert (body["flag_threshold"], body["block_threshold"]) == (50, 85)
    assert body["auto_block_high_risk"] is False
    assert any("Invalid stored thresholds" in m for m in caplog.messages)


def test_out_of_range_stored_row_falls_back(client, db):
    db.add(SystemSetting(id=1, flag_threshold=10, block_threshold=150))
    db.commit()
    body = client.get("/api/settings").json()
    assert (body["flag_threshold"], body["block_threshold"]) == (50, 85)
    assert body["auto_block_high_risk"] is False


def test_put_repairs_invalid_stored_row(client, db):
    db.add(SystemSetting(id=1, flag_threshold=90, block_threshold=10))
    db.commit()
    assert client.put("/api/settings", json={"email_alerts": True}).status_code == 200
    db.expire_all()
    row = db.get(SystemSetting, 1)
    assert (row.flag_threshold, row.block_threshold) == (50, 85)
    assert row.auto_block_high_risk is False


def test_get_settings_never_raises_on_db_error(db, monkeypatch, caplog):
    def boom(*args, **kwargs):
        raise RuntimeError("db down")

    monkeypatch.setattr(db, "get", boom)
    with caplog.at_level("WARNING", logger="fraudshield.settings"):
        cfg = get_settings(db)

    assert cfg.flag_threshold == 50
    assert cfg.block_threshold == 85
    assert cfg.auto_block_high_risk is False
    assert cfg.email_alerts is False
    assert any("Could not load settings" in m for m in caplog.messages)


def test_scoring_changes_with_thresholds(client, db):
    r = client.post("/api/transactions", json=tx_payload(risk_score=25))
    assert r.json()["status"] == "APPROVED"
    assert db.query(FraudAlert).count() == 0

    client.put("/api/settings", json={"flag_threshold": 20, "block_threshold": 40})
    r = client.post("/api/transactions", json=tx_payload(risk_score=25))
    assert r.json()["status"] == "UNDER_REVIEW"
    r = client.post("/api/transactions", json=tx_payload(risk_score=45))
    assert r.json()["status"] == "FLAGGED"
    sev = {a.risk_score: a.severity for a in db.query(FraudAlert).all()}
    assert sev == {25: "MEDIUM", 45: "CRITICAL"}


@pytest.mark.parametrize("auto_block,high_status", [(False, "FLAGGED"), (True, "BLOCKED")])
def test_custom_threshold_exact_boundaries(client, db, auto_block, high_status):
    r = client.put(
        "/api/settings",
        json={"flag_threshold": 30, "block_threshold": 70, "auto_block_high_risk": auto_block},
    )
    assert r.status_code == 200

    res_29 = client.post("/api/transactions", json=tx_payload(risk_score=29)).json()
    res_30 = client.post("/api/transactions", json=tx_payload(risk_score=30)).json()
    res_69 = client.post("/api/transactions", json=tx_payload(risk_score=69)).json()
    res_70 = client.post("/api/transactions", json=tx_payload(risk_score=70)).json()

    assert res_29["status"] == "APPROVED"
    assert res_30["status"] == "UNDER_REVIEW"
    assert res_69["status"] == "UNDER_REVIEW"
    assert res_70["status"] == high_status

    alerts_by_score = {a.risk_score: a.severity for a in db.query(FraudAlert).all()}
    assert alerts_by_score == {30: "MEDIUM", 69: "MEDIUM", 70: "CRITICAL"}


def test_auto_block_default_off_flags_high_risk(client, db):
    r = client.post("/api/transactions", json=tx_payload(risk_score=95))
    assert r.json()["status"] == "FLAGGED"
    assert db.query(FraudAlert).one().severity == "CRITICAL"


def test_auto_block_on_blocks_high_risk_only(client, db):
    r = client.put("/api/settings", json={"auto_block_high_risk": True})
    assert r.status_code == 200

    for score in (50, 84):
        res = client.post("/api/transactions", json=tx_payload(risk_score=score))
        assert res.status_code == 201
        assert res.json()["status"] == "UNDER_REVIEW"

    for score in (85, 100):
        res = client.post("/api/transactions", json=tx_payload(risk_score=score))
        assert res.status_code == 201
        assert res.json()["status"] == "BLOCKED"

    sev = {a.risk_score: a.severity for a in db.query(FraudAlert).all()}
    assert sev == {50: "MEDIUM", 84: "MEDIUM", 85: "CRITICAL", 100: "CRITICAL"}


def test_strict_types_and_null_rejected(client):
    for body in ({"flag_threshold": True}, {"flag_threshold": 50.5}, {"flag_threshold": "50"},
                 {"email_alerts": "yes"}, {"auto_block_high_risk": "true"},
                 {"flag_threshold": None}, {}):
        assert client.put("/api/settings", json=body).status_code == 422, body
