from collections import defaultdict
from datetime import datetime

from app.models import Transaction, FraudAlert
from conftest import make_tx, make_alert


def reference_summary(db):
    """Verbatim copy of the previous in-memory implementation (trends + type distribution)."""
    transactions = db.query(Transaction).order_by(Transaction.timestamp.asc()).all()
    trend_dict = defaultdict(lambda: {"total": 0, "fraud": 0, "volume": 0.0, "fraud_vol": 0.0})
    for tx in transactions:
        day_label = tx.timestamp.strftime("%b %d")
        trend_dict[day_label]["total"] += 1
        trend_dict[day_label]["volume"] += tx.amount
        if tx.status in ("FLAGGED", "BLOCKED"):
            trend_dict[day_label]["fraud"] += 1
            trend_dict[day_label]["fraud_vol"] += tx.amount
    trends = [
        {"time_label": d, "total_count": v["total"], "fraud_count": v["fraud"],
         "total_volume": round(v["volume"], 2), "fraud_volume": round(v["fraud_vol"], 2)}
        for d, v in trend_dict.items()
    ]
    types = {}
    for tx in transactions:
        t = types.setdefault(tx.transaction_type, {"count": 0, "volume": 0.0, "fraud": 0})
        t["count"] += 1
        t["volume"] += tx.amount
        if tx.status in ("FLAGGED", "BLOCKED"):
            t["fraud"] += 1
    dist = {k: {"type_name": k, "count": v["count"], "volume": round(v["volume"], 2), "fraud_count": v["fraud"]}
            for k, v in types.items()}
    return trends, dist


def test_empty_db(client):
    body = client.get("/api/analytics/summary").json()
    assert body["stats"]["total_transactions"] == 0
    assert body["trends"] == [] and body["type_distribution"] == []
    assert body["is_demo_data"] is True


def test_sql_matches_reference(client, db):
    statuses = ["APPROVED", "FLAGGED", "BLOCKED", "UNDER_REVIEW"]
    types = ["ONLINE_PURCHASE", "WIRE_TRANSFER", "P2P_TRANSFER"]
    n = 0
    for day in (20, 5, 14, 5, 28, 20):  # deliberately unordered, with duplicate days
        for k in range(7):
            n += 1
            make_tx(
                db,
                amount=round(13.37 * n + 0.011 * k, 2),
                ttype=types[n % 3],
                status=statuses[n % 4],
                ts=datetime(2025, 11, day, (n * 3) % 24, (n * 7) % 60),
                risk=n % 100,
            )
    # a different month, to check chronological ordering across months
    make_tx(db, amount=42.5, ts=datetime(2025, 10, 31, 23, 59), status="BLOCKED")
    make_tx(db, amount=10.0, ts=datetime(2025, 12, 1, 0, 0), status="APPROVED")

    body = client.get("/api/analytics/summary").json()
    ref_trends, ref_dist = reference_summary(db)

    assert [t["time_label"] for t in body["trends"]][:2] == ["Oct 31", "Nov 05"]
    assert len(body["trends"]) == len(ref_trends)
    for got, exp in zip(body["trends"], ref_trends):
        assert got["time_label"] == exp["time_label"]
        assert got["total_count"] == exp["total_count"]
        assert got["fraud_count"] == exp["fraud_count"]
        assert abs(got["total_volume"] - exp["total_volume"]) < 0.011
        assert abs(got["fraud_volume"] - exp["fraud_volume"]) < 0.011
    assert {k for t in body["trends"] for k in t} == {
        "time_label", "total_count", "fraud_count", "total_volume", "fraud_volume"}

    got_dist = {d["type_name"]: d for d in body["type_distribution"]}
    assert got_dist.keys() == ref_dist.keys()
    for k, exp in ref_dist.items():
        assert got_dist[k]["count"] == exp["count"]
        assert got_dist[k]["fraud_count"] == exp["fraud_count"]
        assert abs(got_dist[k]["volume"] - exp["volume"]) < 0.011


def test_stats_and_alert_counts(client, db):
    t1 = make_tx(db, amount=100.0, status="FLAGGED", risk=60)
    make_tx(db, amount=300.0, status="APPROVED", risk=20)
    make_alert(db, t1.id, severity="CRITICAL", status="RESOLVED")
    make_alert(db, t1.id, severity="LOW", status="NEW")
    s = client.get("/api/analytics/summary").json()["stats"]
    assert s["total_transactions"] == 2
    assert s["fraud_detected"] == 1
    assert s["fraud_detection_rate"] == 50.0
    assert s["total_volume"] == 400.0
    assert s["average_risk_score"] == 40.0
    assert s["high_risk_alerts"] == 1
    assert s["resolved_alerts"] == 1
