from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

# Transaction Schemas
class TransactionBase(BaseModel):
    customer_id: str
    customer_name: Optional[str] = None
    amount: float = Field(..., gt=0)
    currency: str = "USD"
    transaction_type: str
    merchant: Optional[str] = None
    location: Optional[str] = None
    ip_address: Optional[str] = None
    device_type: Optional[str] = None

class TransactionCreate(TransactionBase):
    id: Optional[str] = None
    fraud_probability: Optional[float] = 0.0
    risk_score: Optional[int] = 0
    status: Optional[str] = "APPROVED"

class TransactionResponse(TransactionBase):
    id: str
    timestamp: datetime
    fraud_probability: float
    risk_score: int
    status: str
    is_demo_data: bool

    class Config:
        from_attributes = True

class TransactionListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    transactions: List[TransactionResponse]

# Alert Schemas
class AlertResponse(BaseModel):
    id: str
    transaction_id: str
    severity: str
    risk_score: int
    reason: str
    status: str
    created_at: datetime
    updated_at: datetime
    reviewed_by: Optional[str] = None
    resolution_notes: Optional[str] = None
    is_demo_data: bool
    transaction: Optional[TransactionResponse] = None

    class Config:
        from_attributes = True

class AlertUpdateStatus(BaseModel):
    status: str = Field(..., description="IN_REVIEW, RESOLVED, FALSE_POSITIVE")
    reviewed_by: Optional[str] = "Security Admin"
    resolution_notes: Optional[str] = None

class AlertListResponse(BaseModel):
    total: int
    unresolved_count: int
    alerts: List[AlertResponse]

# Analytics Schemas
class OverviewStats(BaseModel):
    total_transactions: int
    fraud_detected: int
    fraud_detection_rate: float
    total_volume: float
    high_risk_alerts: int
    resolved_alerts: int
    average_risk_score: float

class FraudTrendPoint(BaseModel):
    time_label: str
    total_count: int
    fraud_count: int
    total_volume: float
    fraud_volume: float

class TransactionTypeBreakdown(BaseModel):
    type_name: str
    count: int
    volume: float
    fraud_count: int

class AnalyticsSummaryResponse(BaseModel):
    stats: OverviewStats
    trends: List[FraudTrendPoint]
    type_distribution: List[TransactionTypeBreakdown]
    is_demo_data: bool = True

# Model Performance Schemas
class ConfusionMatrixData(BaseModel):
    true_positive: int
    false_positive: int
    true_negative: int
    false_negative: int

class ModelPerformanceMetrics(BaseModel):
    model_name: str
    model_version: str
    evaluated_at: datetime
    precision: float
    recall: float
    f1_score: float
    pr_auc: float
    roc_auc: float
    confusion_matrix: ConfusionMatrixData
    status: str = "Benchmark Baseline (Pre-Phase 2)"
    is_demo_data: bool = True

# WebSocket Event Message
class LiveEventPayload(BaseModel):
    event_type: str  # "NEW_TRANSACTION", "NEW_ALERT", "ALERT_UPDATED", "SYSTEM_HEARTBEAT"
    timestamp: datetime
    data: dict
