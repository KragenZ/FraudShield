from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database import get_db
from app.models import Transaction, FraudAlert, TransactionStatus, AlertSeverity, AlertStatus
from app.schemas import (
    AnalyticsSummaryResponse, 
    OverviewStats, 
    FraudTrendPoint, 
    TransactionTypeBreakdown
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(db: Session = Depends(get_db)):
    """
    Computes overall transaction metrics, trends, and type distribution.
    """
    total_tx = db.query(Transaction).count()
    if total_tx == 0:
        return {
            "stats": {
                "total_transactions": 0,
                "fraud_detected": 0,
                "fraud_detection_rate": 0.0,
                "total_volume": 0.0,
                "high_risk_alerts": 0,
                "resolved_alerts": 0,
                "average_risk_score": 0.0
            },
            "trends": [],
            "type_distribution": [],
            "is_demo_data": True
        }

    # Fraudulent transactions: FLAGGED or BLOCKED
    fraud_tx_count = db.query(Transaction).filter(
        Transaction.status.in_([TransactionStatus.FLAGGED.value, TransactionStatus.BLOCKED.value])
    ).count()

    total_volume_res = db.query(func.sum(Transaction.amount)).scalar() or 0.0
    avg_risk_res = db.query(func.avg(Transaction.risk_score)).scalar() or 0.0

    high_risk_alerts = db.query(FraudAlert).filter(
        FraudAlert.severity.in_([AlertSeverity.HIGH.value, AlertSeverity.CRITICAL.value])
    ).count()

    resolved_alerts = db.query(FraudAlert).filter(
        FraudAlert.status == AlertStatus.RESOLVED.value
    ).count()

    fraud_rate = round((fraud_tx_count / total_tx) * 100.0, 2) if total_tx > 0 else 0.0

    fraud_statuses = [TransactionStatus.FLAGGED.value, TransactionStatus.BLOCKED.value]
    is_fraud = Transaction.status.in_(fraud_statuses)

    # Daily trends: aggregated in SQL (one row per calendar day)
    day_col = func.date(Transaction.timestamp)
    day_rows = (
        db.query(
            day_col.label("day"),
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.amount), 0.0),
            func.coalesce(func.sum(case((is_fraud, 1), else_=0)), 0),
            func.coalesce(func.sum(case((is_fraud, Transaction.amount), else_=0.0)), 0.0),
        )
        .filter(Transaction.timestamp.isnot(None))
        .group_by(day_col)
        .order_by(day_col.asc())
        .all()
    )
    # Merge days that share the same "%b %d" label (same behaviour as before), keeping chronological order.
    trend_dict = {}
    for day, cnt, vol, fcnt, fvol in day_rows:
        if isinstance(day, str):
            day = date.fromisoformat(day)
        label = day.strftime("%b %d")
        d = trend_dict.setdefault(label, {"total": 0, "fraud": 0, "volume": 0.0, "fraud_vol": 0.0})
        d["total"] += int(cnt)
        d["fraud"] += int(fcnt)
        d["volume"] += float(vol)
        d["fraud_vol"] += float(fvol)

    trends = [
        FraudTrendPoint(
            time_label=day,
            total_count=data["total"],
            fraud_count=data["fraud"],
            total_volume=round(data["volume"], 2),
            fraud_volume=round(data["fraud_vol"], 2)
        )
        for day, data in trend_dict.items()
    ]

    # Type distribution: single grouped query including fraud counts
    type_stats = (
        db.query(
            Transaction.transaction_type,
            func.count(Transaction.id),
            func.sum(Transaction.amount),
            func.coalesce(func.sum(case((is_fraud, 1), else_=0)), 0),
        )
        .group_by(Transaction.transaction_type)
        .order_by(func.min(Transaction.timestamp).asc(), Transaction.transaction_type.asc())
        .all()
    )

    type_distribution = [
        TransactionTypeBreakdown(
            type_name=t_type,
            count=count,
            volume=round(vol or 0.0, 2),
            fraud_count=int(fraud_in_type)
        )
        for t_type, count, vol, fraud_in_type in type_stats
    ]
    return {
        "stats": {
            "total_transactions": total_tx,
            "fraud_detected": fraud_tx_count,
            "fraud_detection_rate": fraud_rate,
            "total_volume": round(total_volume_res, 2),
            "high_risk_alerts": high_risk_alerts,
            "resolved_alerts": resolved_alerts,
            "average_risk_score": round(avg_risk_res, 1)
        },
        "trends": trends,
        "type_distribution": type_distribution,
        "is_demo_data": True
    }
