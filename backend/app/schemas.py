from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, StrictInt, StrictBool, ConfigDict, model_validator
from app.models import TransactionType

# Transaction Schemas
class TransactionBase(BaseModel):
    customer_id: str
    customer_name: Optional[str] = None
    amount: float = Field(..., gt=0, description="Transaction amount (must be positive)")
    currency: str = "USD"
    transaction_type: TransactionType
    merchant: Optional[str] = None
    location: Optional[str] = None
    ip_address: Optional[str] = None
    device_type: Optional[str] = None

class TransactionCreate(TransactionBase):
    id: Optional[str] = None

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
    status: str = Field(..., description="IN_REVIEW, RESOLVED, CONFIRMED_FRAUD, FALSE_POSITIVE")
    reviewed_by: Optional[str] = "Security Admin"
    resolution_notes: Optional[str] = None

class AlertListResponse(BaseModel):
    total: int
    unresolved_count: int
    alerts: List[AlertResponse]
    page: int = 1
    page_size: int = 50
    total_pages: int = 1

# Settings Schemas
class SettingsResponse(BaseModel):
    flag_threshold: int
    block_threshold: int
    auto_block_high_risk: bool
    email_alerts: bool
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class SettingsUpdate(BaseModel):
    """All fields optional (partial update); merged result is validated by the endpoint."""
    flag_threshold: Optional[StrictInt] = Field(default=None, ge=0, le=100)
    block_threshold: Optional[StrictInt] = Field(default=None, ge=0, le=100)
    auto_block_high_risk: Optional[StrictBool] = None
    email_alerts: Optional[StrictBool] = None
    updated_by: Optional[str] = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def _thresholds_ordered(self):
        provided = self.model_fields_set
        if not provided:
            raise ValueError("request body must contain at least one setting")
        for name in ("flag_threshold", "block_threshold", "auto_block_high_risk", "email_alerts"):
            if name in provided and getattr(self, name) is None:
                raise ValueError(f"{name} must not be null")
        if (
            self.flag_threshold is not None
            and self.block_threshold is not None
            and self.flag_threshold >= self.block_threshold
        ):
            raise ValueError("flag_threshold must be less than block_threshold")
        return self

# Analytics Schemas
class OverviewStats(BaseModel):
    total_transactions: int
    fraud_detected: int
    fraud_detection_rate: float
    total_volume: float
    high_risk_alerts: int
    resolved_alerts: int
    average_risk_score: float
    approved_count: int = 0
    under_review_count: int = 0
    flagged_count: int = 0
    blocked_count: int = 0
    approved_rate: float = 0.0
    under_review_rate: float = 0.0
    flagged_rate: float = 0.0
    blocked_rate: float = 0.0

class FraudTrendPoint(BaseModel):
    time_label: str
    total_count: int
    fraud_count: int
    total_volume: float
    fraud_volume: float
    under_review_count: int = 0
    under_review_volume: float = 0.0

class TransactionTypeBreakdown(BaseModel):
    type_name: str
    count: int
    volume: float
    fraud_count: int
    under_review_count: int = 0

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
