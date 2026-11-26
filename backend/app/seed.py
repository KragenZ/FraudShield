import uuid
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import (
    Transaction, 
    FraudAlert, 
    ModelPerformanceRecord,
    TransactionType, 
    AlertSeverity, 
    AlertStatus
)
from app.scoring import classify_transaction, compute_synthetic_probability
from app.settings_service import get_settings

def seed_database(db: Session, force: bool = False):
    """
    Seeds initial realistic DEMO DATA for transactions, alerts, and model performance baseline.
    Explicitly tags records with is_demo_data=True.
    """
    existing_count = db.query(Transaction).count()
    if existing_count > 0 and not force:
        return

    # Clear if force
    if force:
        db.query(FraudAlert).delete()
        db.query(Transaction).delete()
        db.query(ModelPerformanceRecord).delete()
        db.commit()

    cfg = get_settings(db)

    customers = [
        ("CUST-9102", "Elena Rostova", "192.168.1.45", "Chrome on MacOS", "New York, USA"),
        ("CUST-4421", "Marcus Vance", "10.0.4.12", "Safari on iOS", "London, UK"),
        ("CUST-1098", "Aria Takahashi", "172.16.8.90", "Firefox on Windows", "Tokyo, Japan"),
        ("CUST-7723", "David Chen", "192.0.2.14", "Mobile App (Android)", "Singapore, SG"),
        ("CUST-5512", "Sophia Al-Mansoor", "198.51.100.8", "Edge on Windows", "Dubai, UAE"),
        ("CUST-3389", "Lucas Schmidt", "203.0.113.5", "Mobile App (iOS)", "Berlin, Germany"),
        ("CUST-8834", "Amara Okonjo", "102.132.8.11", "Chrome on Windows", "Lagos, Nigeria"),
        ("CUST-2201", "Mateo Silva", "189.28.14.9", "Safari on MacOS", "Sao Paulo, Brazil")
    ]

    merchants = [
        "Stripe Payout", "Apple Store 5th Ave", "Amazon Web Services",
        "Binance Global P2P", "HSBC International Wire", "Target Superstore",
        "ATM Chase Manhattan", "Uber Technologies", "Delta Air Lines",
        "Luxury Watches Direct", "NordVPN Subscription", "Coinbase Inc."
    ]

    types = [
        TransactionType.ONLINE_PURCHASE.value,
        TransactionType.WIRE_TRANSFER.value,
        TransactionType.ATM_WITHDRAWAL.value,
        TransactionType.P2P_TRANSFER.value,
        TransactionType.CRYPTO_EXCHANGE.value,
        TransactionType.MERCHANT_PAYMENT.value,
    ]

    now = datetime.utcnow()
    transactions = []
    alerts = []

    # Generate 50 realistic demo transactions over the last 7 days
    for _ in range(50):
        cust = random.choice(customers)
        t_type = random.choice(types)
        merch = random.choice(merchants)
        time_offset_hours = random.uniform(0.1, 168)
        t_time = now - timedelta(hours=time_offset_hours)

        # Synthetic score generation separated from Option B policy classification
        risk_roll = random.random()
        if risk_roll > 0.85:  # High risk band (85-98)
            risk_score = random.randint(85, 98)
            amount = round(random.uniform(4500.0, 48500.0), 2)
            location = cust[4] if random.random() > 0.4 else "Unknown Proxy IP (Tor Exit Node)"
            ip_address = cust[2] if random.random() > 0.3 else "185.220.101.5"
        elif risk_roll > 0.70:  # Medium risk band (50-84)
            risk_score = random.randint(50, 84)
            amount = round(random.uniform(500.0, 4800.0), 2)
            location = cust[4]
            ip_address = cust[2]
        else:  # Low risk band (2-28)
            risk_score = random.randint(2, 28)
            amount = round(random.uniform(12.50, 850.0), 2)
            location = cust[4]
            ip_address = cust[2]

        fraud_prob = compute_synthetic_probability(risk_score)
        status, severity = classify_transaction(risk_score, cfg)

        t_id = f"TX-{uuid.uuid4().hex[:8].upper()}"
        tx = Transaction(
            id=t_id,
            customer_id=cust[0],
            customer_name=cust[1],
            amount=amount,
            currency="USD",
            transaction_type=t_type,
            timestamp=t_time,
            fraud_probability=fraud_prob,
            risk_score=risk_score,
            status=status,
            merchant=merch,
            location=location,
            ip_address=ip_address,
            device_type=cust[3],
            is_demo_data=True,
        )
        transactions.append(tx)

        if severity is not None:
            if severity in (AlertSeverity.CRITICAL.value, AlertSeverity.HIGH.value):
                reasons = [
                    f"Abnormal high-velocity transfer of ${amount:,.2f} exceeding 5x customer historical baseline.",
                    "Geographic anomaly: Transaction origin mismatched with authenticated device location (Tor Exit Node detected).",
                    "Rapid successive micro-charges followed by large drain to crypto exchange gateway.",
                    "Known mule account routing pattern identified by graph intelligence heuristic.",
                    "New device fingerprint initiated urgent off-hours cross-border wire.",
                ]
                reason = random.choice(reasons)
                alert_status = random.choice([AlertStatus.NEW.value, AlertStatus.IN_REVIEW.value, AlertStatus.RESOLVED.value])
                updated_at = t_time + timedelta(minutes=random.randint(5, 45))
                reviewed_by = "Security Ops" if alert_status != AlertStatus.NEW.value else None
                resolution_notes = (
                    "Investigated user IP history and requested step-up 2FA authentication."
                    if alert_status == AlertStatus.RESOLVED.value
                    else None
                )
            else:
                reason = f"Medium risk transaction of ${amount:,.2f} flagged for automated step-up verification."
                alert_status = AlertStatus.NEW.value
                updated_at = t_time + timedelta(minutes=1)
                reviewed_by = None
                resolution_notes = None

            alerts.append(
                FraudAlert(
                    id=f"ALT-{uuid.uuid4().hex[:8].upper()}",
                    transaction_id=t_id,
                    severity=severity,
                    risk_score=risk_score,
                    reason=reason,
                    status=alert_status,
                    created_at=t_time + timedelta(minutes=1),
                    updated_at=updated_at,
                    reviewed_by=reviewed_by,
                    resolution_notes=resolution_notes,
                    is_demo_data=True,
                )
            )

    # Sort transactions chronologically
    transactions.sort(key=lambda x: x.timestamp, reverse=True)
    for t in transactions:
        db.add(t)
    
    for a in alerts:
        db.add(a)

    # Add baseline model performance benchmark record (explicitly marked as baseline benchmark for Phase 1 UI)
    model_record = ModelPerformanceRecord(
        model_name="XGBoost-Ensemble-v1 (Target Architecture)",
        model_version="v1.0.0-rc (Pre-Training Baseline)",
        precision=0.942,
        recall=0.887,
        f1_score=0.914,
        pr_auc=0.926,
        roc_auc=0.968,
        true_positives=1420,
        false_positives=87,
        true_negatives=48120,
        false_negatives=181,
        evaluated_at=now,
        notes="Benchmark baseline metrics prepared for Phase 2 model training validation suite.",
        is_demo_data=True
    )
    db.add(model_record)

    db.commit()
    print(f"Successfully seeded database with {len(transactions)} transactions and {len(alerts)} fraud alerts.")
