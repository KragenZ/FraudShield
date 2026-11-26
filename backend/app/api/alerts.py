from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import FraudAlert, Transaction, AlertStatus, TransactionStatus
from app.schemas import AlertResponse, AlertListResponse, AlertUpdateStatus
from app.ws_manager import ws_manager

router = APIRouter(prefix="/alerts", tags=["Fraud Alerts"])

@router.get("", response_model=AlertListResponse)
def get_alerts(
    status: Optional[str] = Query(None, description="Filter by status (NEW, IN_REVIEW, RESOLVED, CONFIRMED_FRAUD, FALSE_POSITIVE)"),
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    limit: int = Query(50, ge=1, le=100),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    db: Session = Depends(get_db)
):
    query = db.query(FraudAlert)

    if status and status != "ALL":
        query = query.filter(FraudAlert.status == status)

    if severity and severity != "ALL":
        query = query.filter(FraudAlert.severity == severity)

    total = query.count()
    unresolved_count = db.query(FraudAlert).filter(
        FraudAlert.status.in_([AlertStatus.NEW.value, AlertStatus.IN_REVIEW.value])
    ).count()

    alerts = (
        query.order_by(desc(FraudAlert.created_at), desc(FraudAlert.id))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "unresolved_count": unresolved_count,
        "alerts": alerts,
        "page": page,
        "page_size": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
    }

@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert_detail(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(FraudAlert).filter(FraudAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Alert with id '{alert_id}' not found"
        )
    return alert

@router.patch("/{alert_id}/status", response_model=AlertResponse)
async def update_alert_status(
    alert_id: str,
    update_data: AlertUpdateStatus,
    db: Session = Depends(get_db)
):
    alert = db.query(FraudAlert).filter(FraudAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Alert with id '{alert_id}' not found"
        )

    # Validate status
    valid_statuses = [e.value for e in AlertStatus]
    if update_data.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{update_data.status}'. Must be one of {valid_statuses}"
        )

    previous_alert_status = alert.status
    tx = db.query(Transaction).filter(Transaction.id == alert.transaction_id).first()
    previous_tx_status = tx.status if tx else None

    alert.status = update_data.status
    alert.reviewed_by = update_data.reviewed_by or "Security Analyst"
    if update_data.resolution_notes:
        alert.resolution_notes = update_data.resolution_notes
    alert.updated_at = datetime.utcnow()

    if tx is not None:
        if update_data.status == AlertStatus.FALSE_POSITIVE.value:
            tx.status = TransactionStatus.APPROVED.value
        elif update_data.status == AlertStatus.CONFIRMED_FRAUD.value:
            if tx.status != TransactionStatus.BLOCKED.value:
                tx.status = TransactionStatus.FLAGGED.value
        elif update_data.status == AlertStatus.IN_REVIEW.value:
            if tx.status == TransactionStatus.APPROVED.value:
                tx.status = TransactionStatus.UNDER_REVIEW.value
        # AlertStatus.RESOLVED leaves tx.status unchanged.

    db.commit()
    db.refresh(alert)
    if tx is not None:
        db.refresh(tx)

    # Broadcast update event to all connected clients
    await ws_manager.broadcast({
        "event_type": "ALERT_UPDATED",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "data": {
            "id": alert.id,
            "transaction_id": alert.transaction_id,
            "status": alert.status,
            "previous_alert_status": previous_alert_status,
            "transaction_status": tx.status if tx else None,
            "previous_transaction_status": previous_tx_status,
            "reviewed_by": alert.reviewed_by,
            "resolution_notes": alert.resolution_notes,
            "updated_at": alert.updated_at.isoformat() + "Z",
            "is_demo_data": bool(alert.is_demo_data),
        }
    })

    return alert
