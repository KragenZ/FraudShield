"""Synthetic transaction generator and WebSocket live simulator task."""
import asyncio
import logging
import random
import uuid
from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import AlertStatus, FraudAlert, Transaction, TransactionType
from app.scoring import classify_transaction, compute_synthetic_probability
from app.settings_service import get_settings
from app.ws_manager import ws_manager

logger = logging.getLogger("fraudshield.simulator")

SIMULATOR_MERCHANTS = (
    "Uber Technologies",
    "Amazon Cloud",
    "Coinbase Direct",
    "Target Store #102",
    "TransferWise P2P",
    "Stripe Charge",
)
SIMULATOR_CUSTOMERS = (
    ("CUST-9102", "Elena Rostova", "New York, USA"),
    ("CUST-4421", "Marcus Vance", "London, UK"),
    ("CUST-1098", "Aria Takahashi", "Tokyo, Japan"),
    ("CUST-7723", "David Chen", "Singapore, SG"),
)
SIMULATOR_TYPES = (
    TransactionType.ONLINE_PURCHASE.value,
    TransactionType.P2P_TRANSFER.value,
    TransactionType.WIRE_TRANSFER.value,
    TransactionType.MERCHANT_PAYMENT.value,
)


def generate_simulated_transaction(
    db: Session, rng=None
) -> Tuple[Transaction, Optional[FraudAlert]]:
    """Generate, classify, and persist one synthetic demo transaction and optional alert."""
    rng = rng or random
    cust = rng.choice(SIMULATOR_CUSTOMERS)
    t_type = rng.choice(SIMULATOR_TYPES)
    merch = rng.choice(SIMULATOR_MERCHANTS)

    # Generate synthetic scores across all 3 risk bands separately from policy classification.
    roll = rng.random()
    if roll < 0.15:
        risk_score = rng.randint(85, 96)
        amount = round(rng.uniform(3500.0, 18500.0), 2)
    elif roll < 0.30:
        risk_score = rng.randint(50, 84)
        amount = round(rng.uniform(500.0, 4800.0), 2)
    else:
        risk_score = rng.randint(3, 30)
        amount = round(rng.uniform(15.0, 750.0), 2)

    cfg = get_settings(db)
    status, severity = classify_transaction(risk_score, cfg)

    now = datetime.utcnow()
    tx_id = f"TX-{uuid.uuid4().hex[:8].upper()}"
    tx = Transaction(
        id=tx_id,
        customer_id=cust[0],
        customer_name=cust[1],
        amount=amount,
        currency="USD",
        transaction_type=t_type,
        timestamp=now,
        fraud_probability=compute_synthetic_probability(risk_score),
        risk_score=risk_score,
        status=status,
        merchant=merch,
        location=cust[2],
        ip_address="192.168.1.1",
        device_type="Web Browser",
        is_demo_data=True,
    )
    db.add(tx)

    alert_obj: Optional[FraudAlert] = None
    if severity is not None:
        alert_obj = FraudAlert(
            id=f"ALT-{uuid.uuid4().hex[:8].upper()}",
            transaction_id=tx_id,
            severity=severity,
            risk_score=risk_score,
            reason=f"Real-time heuristic: Risk score {risk_score} detected for ${amount:,.2f} {t_type}.",
            status=AlertStatus.NEW.value,
            created_at=now,
            updated_at=now,
            is_demo_data=True,
        )
        db.add(alert_obj)

    db.commit()
    db.refresh(tx)
    if alert_obj is not None:
        db.refresh(alert_obj)
    return tx, alert_obj


async def live_transaction_simulator() -> None:
    """Periodically inject simulated transactions and broadcast them to WebSocket clients."""
    await asyncio.sleep(5)  # initial startup delay

    while True:
        try:
            await asyncio.sleep(settings.SIMULATION_INTERVAL_SECONDS)
            if not ws_manager.active_connections:
                continue

            db: Session = SessionLocal()
            try:
                tx, alert_obj = generate_simulated_transaction(db)
            finally:
                db.close()

            await ws_manager.broadcast({
                "event_type": "NEW_TRANSACTION",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "data": {
                    "id": tx.id,
                    "customer_id": tx.customer_id,
                    "customer_name": tx.customer_name,
                    "amount": tx.amount,
                    "currency": tx.currency,
                    "transaction_type": tx.transaction_type,
                    "risk_score": tx.risk_score,
                    "fraud_probability": tx.fraud_probability,
                    "status": tx.status,
                    "merchant": tx.merchant,
                    "location": tx.location,
                    "timestamp": tx.timestamp.isoformat() + "Z",
                    "is_demo_data": True,
                },
            })

            if alert_obj is not None:
                await ws_manager.broadcast({
                    "event_type": "NEW_ALERT",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "data": {
                        "id": alert_obj.id,
                        "transaction_id": alert_obj.transaction_id,
                        "severity": alert_obj.severity,
                        "risk_score": alert_obj.risk_score,
                        "reason": alert_obj.reason,
                        "status": alert_obj.status,
                        "created_at": alert_obj.created_at.isoformat() + "Z",
                        "is_demo_data": True,
                    },
                })
        except asyncio.CancelledError:
            break
        except Exception as exc:  # noqa: BLE001
            logger.warning("Live simulator iteration failed: %s", exc, exc_info=True)
            await asyncio.sleep(2)
