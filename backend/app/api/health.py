from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from app.database import get_db
from app.config import settings

router = APIRouter(prefix="/health", tags=["System Health"])

@router.get("")
def health_check(db: Session = Depends(get_db)):
    """
    Returns system health status, database connectivity, and active configuration.
    """
    db_status = "unhealthy"
    try:
        # Check DB connection
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": {
            "status": db_status,
            "engine": "postgresql" if "postgresql" in settings.DATABASE_URL else "sqlite"
        },
        "simulation_mode": settings.ENABLE_LIVE_SIMULATOR,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
