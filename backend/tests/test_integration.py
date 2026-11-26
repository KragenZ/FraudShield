from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import Settings, settings as app_settings
from app.database import get_db
from app.db_migrate import run_migrations
from app.main import app
from app.seed import seed_database


def test_settings_persisted_across_engine_restart(tmp_path):
    db_file = tmp_path / "restart_persistence.db"
    db_url = f"sqlite:///{db_file.as_posix()}"

    eng1 = create_engine(db_url, connect_args={"check_same_thread": False})
    try:
        assert run_migrations(eng1) == "created"
        session_1 = sessionmaker(autocommit=False, autoflush=False, bind=eng1)

        def _override_1():
            s = session_1()
            try:
                yield s
            finally:
                s.close()

        app.dependency_overrides[get_db] = _override_1
        c1 = TestClient(app)
        initial = c1.get("/api/settings")
        assert initial.status_code == 200
        assert initial.json()["flag_threshold"] == 50
        assert initial.json()["block_threshold"] == 85
        assert initial.json()["auto_block_high_risk"] is False

        put_res = c1.put(
            "/api/settings",
            json={
                "flag_threshold": 30,
                "block_threshold": 70,
                "auto_block_high_risk": True,
                "email_alerts": True,
                "updated_by": "integration-ops",
            },
        )
        assert put_res.status_code == 200
    finally:
        app.dependency_overrides.clear()
        eng1.dispose()

    # Recreate engine & session factory against the same SQLite file to simulate restart
    eng2 = create_engine(db_url, connect_args={"check_same_thread": False})
    try:
        session_2 = sessionmaker(autocommit=False, autoflush=False, bind=eng2)

        def _override_2():
            s = session_2()
            try:
                yield s
            finally:
                s.close()

        app.dependency_overrides[get_db] = _override_2
        c2 = TestClient(app)

        persisted = c2.get("/api/settings")
        assert persisted.status_code == 200
        body = persisted.json()
        assert body["flag_threshold"] == 30
        assert body["block_threshold"] == 70
        assert body["auto_block_high_risk"] is True
        assert body["email_alerts"] is True
        assert body["updated_by"] == "integration-ops"

        # Verify subsequent transaction scoring uses the persisted thresholds (30/70, auto_block=True)
        # Real attribute-derived scores: normal $50 -> 5, $20,000 -> 78 (>= 70 -> BLOCKED)
        tx_low = c2.post(
            "/api/transactions",
            json={"customer_id": "C-1", "amount": 50.0, "transaction_type": "ONLINE_PURCHASE"},
        )
        tx_high = c2.post(
            "/api/transactions",
            json={"customer_id": "C-1", "amount": 20000.0, "transaction_type": "ONLINE_PURCHASE"},
        )
        assert tx_low.status_code == 201 and tx_low.json()["risk_score"] == 5 and tx_low.json()["status"] == "APPROVED"
        assert tx_high.status_code == 201 and tx_high.json()["risk_score"] == 78 and tx_high.json()["status"] == "BLOCKED"
    finally:
        app.dependency_overrides.clear()
        eng2.dispose()


def test_app_config_opt_in_defaults(monkeypatch):
    monkeypatch.delenv("ENABLE_LIVE_SIMULATOR", raising=False)
    monkeypatch.delenv("AUTO_MIGRATE_ON_STARTUP", raising=False)

    fresh = Settings(_env_file=None)
    assert fresh.ENABLE_LIVE_SIMULATOR is False
    assert fresh.AUTO_MIGRATE_ON_STARTUP is False
    assert app_settings.ENABLE_LIVE_SIMULATOR is False
    assert app_settings.AUTO_MIGRATE_ON_STARTUP is False


def test_end_to_end_api_regression_suite(client, db):
    # 1. Health check
    health = client.get("/api/health")
    assert health.status_code == 200
    h_body = health.json()
    assert h_body["status"] == "healthy"
    assert h_body["database"]["status"] == "connected"
    assert h_body["simulation_mode"] is False

    # 2. Settings default & update roundtrip
    s_get = client.get("/api/settings")
    assert s_get.status_code == 200
    assert s_get.json()["auto_block_high_risk"] is False

    # 3. Transactions ingest + query + detail (using real attribute-derived scores: 5, 78, 88)
    r_app = client.post(
        "/api/transactions",
        json={"customer_id": "CUST-1", "amount": 45.0, "transaction_type": "MERCHANT_PAYMENT"},
    )
    r_rev = client.post(
        "/api/transactions",
        json={"customer_id": "CUST-2", "amount": 15000.0, "transaction_type": "P2P_TRANSFER"},
    )
    r_flg = client.post(
        "/api/transactions",
        json={"customer_id": "CUST-3", "amount": 900.0, "transaction_type": "WIRE_TRANSFER", "location": "Tor exit node"},
    )
    assert r_app.status_code == 201 and r_app.json()["status"] == "APPROVED"
    assert r_rev.status_code == 201 and r_rev.json()["status"] == "UNDER_REVIEW"
    assert r_flg.status_code == 201 and r_flg.json()["status"] == "FLAGGED"

    tx_list = client.get("/api/transactions", params={"status": "UNDER_REVIEW", "min_risk": 50})
    assert tx_list.status_code == 200
    assert tx_list.json()["total"] == 1
    assert tx_list.json()["transactions"][0]["id"] == r_rev.json()["id"]

    tx_detail = client.get(f"/api/transactions/{r_flg.json()['id']}")
    assert tx_detail.status_code == 200
    assert tx_detail.json()["status"] == "FLAGGED"

    # 4. Alerts list + detail + status resolution
    alerts_res = client.get("/api/alerts")
    assert alerts_res.status_code == 200
    alerts_body = alerts_res.json()
    assert alerts_body["total"] == 2
    assert alerts_body["unresolved_count"] == 2

    crit_alert = next(a for a in alerts_body["alerts"] if a["severity"] == "CRITICAL")
    a_detail = client.get(f"/api/alerts/{crit_alert['id']}")
    assert a_detail.status_code == 200
    a_patch = client.patch(
        f"/api/alerts/{crit_alert['id']}/status",
        json={"status": "RESOLVED", "resolution_notes": "Confirmed fraud"},
    )
    assert a_patch.status_code == 200 and a_patch.json()["status"] == "RESOLVED"

    # 5. Analytics summary
    analytics = client.get("/api/analytics/summary")
    assert analytics.status_code == 200
    stats = analytics.json()["stats"]
    assert stats["total_transactions"] == 3
    assert stats["approved_count"] == 1
    assert stats["under_review_count"] == 1
    assert stats["flagged_count"] == 1
    assert stats["blocked_count"] == 0
    assert stats["fraud_detected"] == 1
    assert stats["high_risk_alerts"] == 1
    assert stats["resolved_alerts"] == 1

    # 6. Model metrics (default fallback + seeded record)
    m_fallback = client.get("/api/model/metrics")
    assert m_fallback.status_code == 200
    mb = m_fallback.json()
    assert mb["precision"] > 0 and mb["recall"] > 0 and mb["is_demo_data"] is True
    assert {"true_positive", "false_positive", "true_negative", "false_negative"} <= set(mb["confusion_matrix"])

    seed_database(db, force=True)
    m_seeded = client.get("/api/model/metrics")
    assert m_seeded.status_code == 200
    assert m_seeded.json()["model_name"].startswith("XGBoost-Ensemble")


def test_websocket_live_feed_ping_and_broadcast(client):
    with client.websocket_connect("/ws/live") as ws:
        hello = ws.receive_json()
        assert hello["event_type"] == "CONNECTED"

        ws.send_text("ping")
        assert ws.receive_text() == "pong"

        res = client.post(
            "/api/transactions",
            json={
                "customer_id": "WS-1",
                "amount": 500.0,
                "transaction_type": "ONLINE_PURCHASE",
                "merchant": "Shadow Exchange",
                "location": "Tor exit node",
                "ip_address": "185.220.101.5",
                "device_type": "Linux Desktop",
            },
        )
        assert res.status_code == 201
        tx_id = res.json()["id"]

        tx_evt = ws.receive_json()
        assert tx_evt["event_type"] == "NEW_TRANSACTION"
        tx_data = tx_evt["data"]
        assert tx_data["id"] == tx_id
        assert tx_data["status"] == "FLAGGED"
        assert tx_data["merchant"] == "Shadow Exchange"
        assert tx_data["location"] == "Tor exit node"
        assert tx_data["ip_address"] == "185.220.101.5"
        assert tx_data["device_type"] == "Linux Desktop"
        assert tx_data["is_demo_data"] is True

        alert_evt = ws.receive_json()
        assert alert_evt["event_type"] == "NEW_ALERT"
        alert_data = alert_evt["data"]
        assert alert_data["transaction_id"] == tx_id
        assert alert_data["severity"] == "CRITICAL"
        assert alert_data["is_demo_data"] is True

        # Resolving alert broadcasts enriched ALERT_UPDATED payload
        patch_res = client.patch(
            f"/api/alerts/{alert_data['id']}/status",
            json={"status": "FALSE_POSITIVE", "reviewed_by": "WS Analyst"},
        )
        assert patch_res.status_code == 200

        upd_evt = ws.receive_json()
        assert upd_evt["event_type"] == "ALERT_UPDATED"
        upd_data = upd_evt["data"]
        assert upd_data["id"] == alert_data["id"]
        assert upd_data["transaction_id"] == tx_id
        assert upd_data["status"] == "FALSE_POSITIVE"
        assert upd_data["previous_alert_status"] == "NEW"
        assert upd_data["transaction_status"] == "APPROVED"
        assert upd_data["previous_transaction_status"] == "FLAGGED"
        assert upd_data["is_demo_data"] is True
