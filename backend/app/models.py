from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
import enum
from app.database import Base

class TransactionType(str, enum.Enum):
    ONLINE_PURCHASE = "ONLINE_PURCHASE"
    WIRE_TRANSFER = "WIRE_TRANSFER"
    ATM_WITHDRAWAL = "ATM_WITHDRAWAL"
    P2P_TRANSFER = "P2P_TRANSFER"
    CRYPTO_EXCHANGE = "CRYPTO_EXCHANGE"
    MERCHANT_PAYMENT = "MERCHANT_PAYMENT"

class TransactionStatus(str, enum.Enum):
    APPROVED = "APPROVED"
    FLAGGED = "FLAGGED"
    BLOCKED = "BLOCKED"
    UNDER_REVIEW = "UNDER_REVIEW"

class AlertSeverity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class AlertStatus(str, enum.Enum):
    NEW = "NEW"
    IN_REVIEW = "IN_REVIEW"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(64), primary_key=True, index=True)
    customer_id = Column(String(64), index=True, nullable=False)
    customer_name = Column(String(128), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD")
    transaction_type = Column(String(32), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Risk & ML indicators
    fraud_probability = Column(Float, default=0.0)
    risk_score = Column(Integer, default=0)
    status = Column(String(32), default=TransactionStatus.APPROVED.value, index=True)
    
    # Metadata & Context
    merchant = Column(String(128), nullable=True)
    location = Column(String(128), nullable=True)
    ip_address = Column(String(45), nullable=True)
    device_type = Column(String(64), nullable=True)
    is_demo_data = Column(Boolean, default=True)

    # Relationships
    alerts = relationship("FraudAlert", back_populates="transaction", cascade="all, delete-orphan")

class FraudAlert(Base):
    __tablename__ = "fraud_alerts"

    id = Column(String(64), primary_key=True, index=True)
    transaction_id = Column(String(64), ForeignKey("transactions.id"), nullable=False, index=True)
    severity = Column(String(16), default=AlertSeverity.HIGH.value, index=True)
    risk_score = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(32), default=AlertStatus.NEW.value, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_by = Column(String(128), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    is_demo_data = Column(Boolean, default=True)

    # Relationships
    transaction = relationship("Transaction", back_populates="alerts")

class ModelPerformanceRecord(Base):
    __tablename__ = "model_performance_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_name = Column(String(64), default="XGBoost-Ensemble-v1")
    model_version = Column(String(32), default="v1.0.0-baseline")
    precision = Column(Float, nullable=False)
    recall = Column(Float, nullable=False)
    f1_score = Column(Float, nullable=False)
    pr_auc = Column(Float, nullable=False)
    roc_auc = Column(Float, nullable=False)
    true_positives = Column(Integer, nullable=False)
    false_positives = Column(Integer, nullable=False)
    true_negatives = Column(Integer, nullable=False)
    false_negatives = Column(Integer, nullable=False)
    evaluated_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    is_demo_data = Column(Boolean, default=True)
