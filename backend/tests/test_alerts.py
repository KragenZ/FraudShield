from datetime import datetime, timedelta

from conftest import make_alert, make_tx


def seed(db, n=7):
    tx = make_tx(db)
    base = datetime(2025, 11, 20, 12, 0)
    for i in range(n):
        make_alert(
            db, tx.id, aid=f"ALT-{i:03d}",
            severity="CRITICAL" if i % 2 == 0 else "HIGH",
            status="NEW" if i < 4 else "RESOLVED",
            created_at=base + timedelta(minutes=i),
        )
    return tx


def test_empty_alerts_page_metadata(client):
    b = client.get("/api/alerts").json()
    assert b["total"] == 0
    assert b["unresolved_count"] == 0
    assert (b["page"], b["page_size"], b["total_pages"]) == (1, 50, 1)
    assert b["alerts"] == []


def test_default_response_has_page_fields(client, db):
    seed(db)
    b = client.get("/api/alerts").json()
    assert b["total"] == 7 and b["unresolved_count"] == 4
    assert (b["page"], b["page_size"], b["total_pages"]) == (1, 50, 1)
    assert [a["id"] for a in b["alerts"]][0] == "ALT-006"  # newest first


def test_pagination(client, db):
    seed(db)
    p1 = client.get("/api/alerts", params={"limit": 3, "page": 1}).json()
    p2 = client.get("/api/alerts", params={"limit": 3, "page": 2}).json()
    p3 = client.get("/api/alerts", params={"limit": 3, "page": 3}).json()
    p4 = client.get("/api/alerts", params={"limit": 3, "page": 4}).json()
    assert p1["total_pages"] == 3 and p1["page_size"] == 3 and p2["page"] == 2
    ids = [a["id"] for p in (p1, p2, p3) for a in p["alerts"]]
    assert ids == [f"ALT-{i:03d}" for i in range(6, -1, -1)]
    assert p4["alerts"] == [] and p4["total"] == 7


def test_id_tiebreaker_is_stable(client, db):
    tx = make_tx(db)
    same = datetime(2025, 11, 20, 12, 0)
    for i in range(5):
        make_alert(db, tx.id, aid=f"ALT-T{i}", created_at=same)
    ids = [a["id"] for p in (1, 2, 3) for a in
           client.get("/api/alerts", params={"limit": 2, "page": p}).json()["alerts"]]
    assert ids == [f"ALT-T{i}" for i in range(4, -1, -1)]


def test_filters(client, db):
    seed(db)
    assert client.get("/api/alerts", params={"status": "RESOLVED"}).json()["total"] == 3
    assert client.get("/api/alerts", params={"severity": "CRITICAL"}).json()["total"] == 4
    assert client.get("/api/alerts", params={"status": "NEW", "severity": "HIGH"}).json()["total"] == 2
    assert client.get("/api/alerts", params={"status": "ALL", "severity": "ALL"}).json()["total"] == 7


def test_invalid_pagination_params(client):
    assert client.get("/api/alerts", params={"page": 0}).status_code == 422
    assert client.get("/api/alerts", params={"limit": 101}).status_code == 422


def test_detail_404(client, db):
    seed(db, 1)
    assert client.get("/api/alerts/ALT-000").status_code == 200
    assert client.get("/api/alerts/NOPE").status_code == 404
    assert client.patch("/api/alerts/NOPE/status", json={"status": "RESOLVED"}).status_code == 404


def test_patch_status_and_invalid(client, db):
    seed(db, 3)
    # Initially 3 NEW alerts -> unresolved_count == 3
    assert client.get("/api/alerts").json()["unresolved_count"] == 3

    r_in_rev = client.patch("/api/alerts/ALT-000/status", json={"status": "IN_REVIEW", "reviewed_by": "Analyst A"})
    assert r_in_rev.status_code == 200 and r_in_rev.json()["status"] == "IN_REVIEW"
    # IN_REVIEW is still unresolved
    assert client.get("/api/alerts").json()["unresolved_count"] == 3

    r_fp = client.patch("/api/alerts/ALT-001/status", json={"status": "FALSE_POSITIVE"})
    assert r_fp.status_code == 200 and r_fp.json()["status"] == "FALSE_POSITIVE"
    assert client.get("/api/alerts").json()["unresolved_count"] == 2

    r_res = client.patch("/api/alerts/ALT-000/status", json={"status": "RESOLVED", "resolution_notes": "ok"})
    assert r_res.status_code == 200 and r_res.json()["status"] == "RESOLVED"
    assert client.get("/api/alerts").json()["unresolved_count"] == 1

    r_bad = client.patch("/api/alerts/ALT-000/status", json={"status": "BOGUS"})
    assert r_bad.status_code == 400
