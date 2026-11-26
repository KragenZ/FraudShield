from collections import defaultdict
from datetime import datetime

from app.models import Transaction
from conftest import make_alert, make_tx


def reference_summary(db):
    """Reference in-memory implementation matching Stage 3 analytics semantics."""
    transactions = db.query(Transaction).order_by(Transaction.timestamp.asc()).all()
    trend_dict = defaultdict(
        lambda: {
            "total": 0,
            "fraud": 0,
            "volume": 0.0,
            "fraud_vol": 0.0,
            "under_review": 0,
            "under_review_vol": 0.0,
        }
    )
    for tx in transactions:
        day_label = tx.timestamp.strftime("%b %d")
        trend_dict[day_label]["total"] += 1
        trend_dict[day_label]["volume"] += tx.amount
        if tx.status in ("FLAGGED", "BLOCKED"):
            trend_dict[day_label]["fraud"] += 1
            trend_dict[day_label]["fraud_vol"] += tx.amount
        elif tx.status == "UNDER_REVIEW":
            trend_dict[day_label]["under_review"] += 1
            trend_dict[day_label]["under_review_vol"] += tx.amount

    trends = [
        {
            "time_label": d,
            "total_count": v["total"],
            "fraud_count": v["fraud"],
            "total_volume": round(v["volume"], 2),
            "fraud_volume": round(v["fraud_vol"], 2),
            "under_review_count": v["under_review"],
            "under_review_volume": round(v["under_review_vol"], 2),
        }
        for d, v in trend_dict.items()
    ]

    types = {}
    for tx in transactions:
        t = types.setdefault(
            tx.transaction_type,
            {"count": 0, "volume": 0.0, "fraud": 0, "under_review": 0},
        )
        t["count"] += 1
        t["volume"] += tx.amount
        if tx.status in ("FLAGGED", "BLOCKED"):
            t["fraud"] += 1
        elif tx.status == "UNDER_REVIEW":
            t["under_review"] += 1

    dist = {
        k: {
            "type_name": k,
            "count": v["count"],
            "volume": round(v["volume"], 2),
            "fraud_count": v["fraud"],
            "under_review_count": v["under_review"],
        }
        for k, v in types.items()
    }
    return trends, dist


def test_empty_db(client):
    body = client.get("/api/analytics/summary").json()
    assert body["stats"] == {
        "total_transactions": 0,
        "fraud_detected": 0,
        "fraud_detection_rate": 0.0,
        "total_volume": 0.0,
        "high_risk_alerts": 0,
        "resolved_alerts": 0,
        "average_risk_score": 0.0,
        "approved_count": 0,
        "under_review_count": 0,
        "flagged_count": 0,
        "blocked_count": 0,
        "approved_rate": 0.0,
        "under_review_rate": 0.0,
        "flagged_rate": 0.0,
        "blocked_rate": 0.0,
    }
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
        assert got["under_review_count"] == exp["under_review_count"]
        assert abs(got["total_volume"] - exp["total_volume"]) < 0.011
        assert abs(got["fraud_volume"] - exp["fraud_volume"]) < 0.011
        assert abs(got["under_review_volume"] - exp["under_review_volume"]) < 0.011
    assert {k for t in body["trends"] for k in t} == {
        "time_label",
        "total_count",
        "fraud_count",
        "total_volume",
        "fraud_volume",
        "under_review_count",
        "under_review_volume",
    }

    got_dist = {d["type_name"]: d for d in body["type_distribution"]}
    assert got_dist.keys() == ref_dist.keys()
    for k, exp in ref_dist.items():
        assert got_dist[k]["count"] == exp["count"]
        assert got_dist[k]["fraud_count"] == exp["fraud_count"]
        assert got_dist[k]["under_review_count"] == exp["under_review_count"]
        assert abs(got_dist[k]["volume"] - exp["volume"]) < 0.011


def test_stats_status_breakdown_and_alert_counts(client, db):
    t1 = make_tx(db, amount=100.0, status="FLAGGED", risk=90)
    make_tx(db, amount=200.0, status="BLOCKED", risk=95)
    make_tx(db, amount=300.0, status="UNDER_REVIEW", risk=65)
    make_tx(db, amount=400.0, status="UNDER_REVIEW", risk=70)
    make_tx(db, amount=500.0, status="APPROVED", risk=10)
    make_tx(db, amount=500.0, status="APPROVED", risk=20)
    make_tx(db, amount=500.0, status="APPROVED", risk=30)
    make_tx(db, amount=500.0, status="APPROVED", risk=20)

    make_alert(db, t1.id, severity="CRITICAL", status="RESOLVED")
    make_alert(db, t1.id, severity="HIGH", status="NEW")
    make_alert(db, t1.id, severity="MEDIUM", status="NEW")

    s = client.get("/api/analytics/summary").json()["stats"]
    assert s["total_transactions"] == 8
    assert s["approved_count"] == 4
    assert s["under_review_count"] == 2
    assert s["flagged_count"] == 1
    assert s["blocked_count"] == 1

    # Sum of status counts equals total_transactions
    assert (
        s["approved_count"] + s["under_review_count"] + s["flagged_count"] + s["blocked_count"]
        == s["total_transactions"]
    )
    # Backward-compatible fraud_detected equals flagged + blocked (excludes UNDER_REVIEW)
    assert s["fraud_detected"] == s["flagged_count"] + s["blocked_count"] == 2
    assert s["fraud_detection_rate"] == 25.0

    assert s["approved_rate"] == 50.0
    assert s["under_review_rate"] == 25.0
    assert s["flagged_rate"] == 12.5
    assert s["blocked_rate"] == 12.5
    assert (
        s["approved_rate"] + s["under_review_rate"] + s["flagged_rate"] + s["blocked_rate"]
        == 100.0
    )

    assert s["total_volume"] == 3000.0
    assert s["average_risk_score"] == round((90 + 95 + 65 + 70 + 10 + 20 + 30 + 20) / 8, 1)
    assert s["high_risk_alerts"] == 2
    assert s["resolved_alerts"] == 1


def test_under_review_not_counted_as_approved_or_fraud(client, db):
    make_tx(db, amount=100.0, status="UNDER_REVIEW", risk=60)
    make_tx(db, amount=100.0, status="UNDER_REVIEW", risk=75)
    make_tx(db, amount=100.0, status="APPROVED", risk=10)

    s = client.get("/api/analytics/summary").json()["stats"]
    assert s["total_transactions"] == 3
    assert s["approved_count"] == 1
    assert s["under_review_count"] == 2
    assert s["flagged_count"] == 0
    assert s["blocked_count"] == 0
    assert s["fraud_detected"] == 0
    assert s["fraud_detection_rate"] == 0.0
    assert abs(
        (s["approved_rate"] + s["under_review_rate"] + s["flagged_rate"] + s["blocked_rate"]) - 100.0
    ) < 0.05
