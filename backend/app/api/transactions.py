import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.database import get_db
from app.models import Transaction, FraudAlert, TransactionStatus, AlertSeverity, AlertStatus
from app.schemas import (
    TransactionResponse, 
    TransactionListResponse, 
    TransactionCreate
)
from app.ws_manager import ws_manager

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("", response_model=TransactionListResponse)
def get_transactions(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(15, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by ID, customer name, merchant"),
    status: Optional[str] = Query(None, description="Filter by status (APPROVED, FLAGGED, BLOCKED, UNDER_REVIEW)"),
    transaction_type: Optional[str] = Query(None, description="Filter by type"),
    min_risk: Optional[int] = Query(None, ge=0, le=100, description="Minimum risk score"),
    max_risk: Optional[int] = Query(None, ge=0, le=100, description="Maximum risk score"),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Transaction.id.ilike(search_filter),
                Transaction.customer_id.ilike(search_filter),
                Transaction.customer_name.ilike(search_filter),
                Transaction.merchant.ilike(search_filter),
                Transaction.location.ilike(search_filter)
            )
        )

    if status and status != "ALL":
        query = query.filter(Transaction.status == status)

    if transaction_type and transaction_type != "ALL":
        query = query.filter(Transaction.transaction_type == transaction_type)

    if min_risk is not None:
        query = query.filter(Transaction.risk_score >= min_risk)

    if max_risk is not None:
        query = query.filter(Transaction.risk_score <= max_risk)

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    offset = (page - 1) * page_size

    transactions = (
        query.order_by(desc(Transaction.timestamp))
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "transactions": transactions
    }

@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction_detail(transaction_id: str, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Transaction with id '{transaction_id}' not found"
        )
    return tx

@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate, 
    db: Session = Depends(get_db)
):
    """
    Ingests a new transaction, performs basic Phase 1 rule checks to derive risk score,
    creates alerts if high-risk, and broadcasts to connected WebSocket clients.
    """
    tx_id = payload.id or f"TX-{uuid.uuid4().hex[:8].upper()}"
    
    # Phase 1 heuristic rule checks (prior to Phase 2 ML model deployment)
    risk_score = payload.risk_score or 5
    if payload.amount > 10000:
        risk_score = max(risk_score, 78)
    if "Tor" in (payload.location or "") or "Unknown" in (payload.location or ""):
        risk_score = max(risk_score, 88)
    if payload.transaction_type in ("CRYPTO_EXCHANGE", "WIRE_TRANSFER") and payload.amount > 5000:
        risk_score = max(risk_score, 82)

    fraud_prob = round(risk_score / 100.0, 3)
    
    tx_status = payload.status or "APPROVED"
    if risk_score >= 85:
        tx_status = TransactionStatus.BLOCKED.value if risk_score >= 92 else TransactionStatus.FLAGGED.value
    elif risk_score >= 50:
        tx_status = TransactionStatus.UNDER_REVIEW.value

    new_tx = Transaction(
        id=tx_id,
        customer_id=payload.customer_id,
        customer_name=payload.customer_name or "Verified Customer",
        amount=payload.amount,
        currency=payload.currency,
        transaction_type=payload.transaction_type,
        timestamp=datetime.utcnow(),
        fraud_probability=fraud_prob,
        risk_score=risk_score,
        status=tx_status,
        merchant=payload.merchant,
        location=payload.location or "Direct Terminal",
        ip_address=payload.ip_address or "127.0.0.1",
        device_type=payload.device_type or "Mobile Device",
        is_demo_data=True
    )
    db.add(new_tx)

    # If high or critical risk, automatically trigger alert
    alert_created = None
    if risk_score >= 60:
        severity = AlertSeverity.CRITICAL.value if risk_score >= 85 else AlertSeverity.HIGH.value
        alert_created = FraudAlert(
            id=f"ALT-{uuid.uuid4().hex[:8].upper()}",
            transaction_id=tx_id,
            severity=severity,
            risk_score=risk_score,
            reason=f"Real-time rule engine detected high risk activity (${payload.amount:,.2f} via {payload.transaction_type}).",
            status=AlertStatus.NEW.value,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            is_demo_data=True
        )
        db.add(alert_created)

    db.commit()
    db.refresh(new_tx)

    # Broadcast event via WebSocket
    event_data = {
        "event_type": "NEW_TRANSACTION",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "data": {
            "id": new_tx.id,
            "customer_id": new_tx.customer_id,
            "customer_name": new_tx.customer_name,
            "amount": new_tx.amount,
            "currency": new_tx.currency,
            "transaction_type": new_tx.transaction_type,
            "risk_score": new_tx.risk_score,
            "fraud_probability": new_tx.fraud_probability,
            "status": new_tx.status,
            "timestamp": new_tx.timestamp.isoformat() + "Z"
        }
    }
    await ws_manager.broadcast(event_data)

    if alert_created:
        alert_event = {
            "event_type": "NEW_ALERT",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "data": {
                "id": alert_created.id,
                "transaction_id": alert_created.transaction_id,
                "severity": alert_created.severity,
                "risk_score": alert_created.risk_score,
                "reason": alert_created.reason,
                "status": alert_created.status,
                "created_at": alert_created.created_at.isoformat() + "Z"
            }
        }
        await ws_manager.broadcast(alert_event)

    return new_tx
