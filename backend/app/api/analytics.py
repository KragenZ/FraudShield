from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

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

    # Group transactions by day for trends (last 7 days)
    transactions = db.query(Transaction).order_by(Transaction.timestamp.asc()).all()
    trend_dict = defaultdict(lambda: {"total": 0, "fraud": 0, "volume": 0.0, "fraud_vol": 0.0})

    for tx in transactions:
        day_label = tx.timestamp.strftime("%b %d")
        trend_dict[day_label]["total"] += 1
        trend_dict[day_label]["volume"] += tx.amount
        if tx.status in (TransactionStatus.FLAGGED.value, TransactionStatus.BLOCKED.value):
            trend_dict[day_label]["fraud"] += 1
            trend_dict[day_label]["fraud_vol"] += tx.amount

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

    # Type distribution
    type_stats = (
        db.query(
            Transaction.transaction_type,
            func.count(Transaction.id),
            func.sum(Transaction.amount)
        )
        .group_by(Transaction.transaction_type)
        .all()
    )

    type_distribution = []
    for t_type, count, vol in type_stats:
        fraud_in_type = db.query(Transaction).filter(
            Transaction.transaction_type == t_type,
            Transaction.status.in_([TransactionStatus.FLAGGED.value, TransactionStatus.BLOCKED.value])
        ).count()
        type_distribution.append(
            TransactionTypeBreakdown(
                type_name=t_type,
                count=count,
                volume=round(vol or 0.0, 2),
                fraud_count=fraud_in_type
            )
        )

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
