import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.database import get_db
from app.models import Transaction, FraudAlert, AlertStatus
from app.schemas import (
    TransactionResponse, 
    TransactionListResponse, 
    TransactionCreate
)
from app.ws_manager import ws_manager
from app.scoring import (
    classify_transaction,
    compute_heuristic_risk_score,
    compute_synthetic_probability,
)
from app.settings_service import get_settings

router = APIRouter(prefix="/transactions", tags=["Transactions"])

def escape_like(text: str, escape_char: str = "\\") -> str:
    """
    Escapes special SQL LIKE/ILIKE wildcard characters (% and _) as well as the escape character itself.
    Prevents wildcard injection and unintended full table scans caused by arbitrary wildcards (e.g. '%%%%').
    """
    return (
        text.replace(escape_char, f"{escape_char}{escape_char}")
        .replace("%", f"{escape_char}%")
        .replace("_", f"{escape_char}_")
    )

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
        escaped_search = escape_like(search.strip())
        search_filter = f"%{escaped_search}%"
        query = query.filter(
            or_(
                Transaction.id.ilike(search_filter, escape="\\"),
                Transaction.customer_id.ilike(search_filter, escape="\\"),
                Transaction.customer_name.ilike(search_filter, escape="\\"),
                Transaction.merchant.ilike(search_filter, escape="\\"),
                Transaction.location.ilike(search_filter, escape="\\")
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

    t_type_val = (
        payload.transaction_type.value
        if hasattr(payload.transaction_type, "value")
        else str(payload.transaction_type)
    )
    risk_score = compute_heuristic_risk_score(
        amount=payload.amount,
        transaction_type=t_type_val,
        location=payload.location,
        base_score=payload.risk_score,
    )
    fraud_prob = compute_synthetic_probability(risk_score)
    cfg = get_settings(db)
    tx_status, severity = classify_transaction(risk_score, cfg)

    new_tx = Transaction(
        id=tx_id,
        customer_id=payload.customer_id,
        customer_name=payload.customer_name or "Verified Customer",
        amount=payload.amount,
        currency=payload.currency,
        transaction_type=t_type_val,
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
    if severity is not None:
        alert_created = FraudAlert(
            id=f"ALT-{uuid.uuid4().hex[:8].upper()}",
            transaction_id=tx_id,
            severity=severity,
            risk_score=risk_score,
            reason=f"Real-time rule engine detected high risk activity (${payload.amount:,.2f} via {t_type_val}).",
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
