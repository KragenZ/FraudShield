from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ModelPerformanceRecord
from app.schemas import ModelPerformanceMetrics, ConfusionMatrixData

router = APIRouter(prefix="/model", tags=["Model Performance"])

@router.get("/metrics", response_model=ModelPerformanceMetrics)
def get_model_metrics(db: Session = Depends(get_db)):
    """
    Returns baseline model performance metrics prepared for the UI.
    Note: Phase 1 provides pre-training benchmark figures clearly labeled as baseline.
    Phase 2 will plug into the trained XGBoost & Scikit-learn pipelines with actual validation results.
    """
    record = db.query(ModelPerformanceRecord).first()
    if not record:
        # Default baseline if record was not seeded
        return {
            "model_name": "XGBoost-Ensemble-v1 (Target Architecture)",
            "model_version": "v1.0.0-rc (Pre-Training Baseline)",
            "evaluated_at": datetime.utcnow(),
            "precision": 0.942,
            "recall": 0.887,
            "f1_score": 0.914,
            "pr_auc": 0.926,
            "roc_auc": 0.968,
            "confusion_matrix": {
                "true_positive": 1420,
                "false_positive": 87,
                "true_negative": 48120,
                "false_negative": 181
            },
            "status": "Benchmark Baseline (Pre-Phase 2)",
            "is_demo_data": True
        }

    return {
        "model_name": record.model_name,
        "model_version": record.model_version,
        "evaluated_at": record.evaluated_at,
        "precision": record.precision,
        "recall": record.recall,
        "f1_score": record.f1_score,
        "pr_auc": record.pr_auc,
        "roc_auc": record.roc_auc,
        "confusion_matrix": {
            "true_positive": record.true_positives,
            "false_positive": record.false_positives,
            "true_negative": record.true_negatives,
            "false_negative": record.false_negatives
        },
        "status": "Benchmark Baseline (Pre-Phase 2)",
        "is_demo_data": True
    }
