from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SystemSetting
from app.schemas import SettingsResponse, SettingsUpdate
from app.settings_service import (
    DEFAULT_AUTO_BLOCK_HIGH_RISK,
    DEFAULT_BLOCK_THRESHOLD,
    DEFAULT_FLAG_THRESHOLD,
    SETTINGS_ROW_ID,
    get_settings,
)

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=SettingsResponse)
def read_settings(db: Session = Depends(get_db)):
    return get_settings(db)


@router.put("", response_model=SettingsResponse)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    current = get_settings(db)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)

    flag = changes.get("flag_threshold", current.flag_threshold)
    block = changes.get("block_threshold", current.block_threshold)
    if flag >= block:
        raise HTTPException(
            status_code=422,
            detail=[{
                "type": "value_error",
                "loc": ["body"],
                "msg": f"flag_threshold ({flag}) must be less than block_threshold ({block})",
            }],
        )

    row = db.get(SystemSetting, SETTINGS_ROW_ID)
    if row is None:  # get_settings failed to persist a row; create it now
        row = SystemSetting(id=SETTINGS_ROW_ID)
        db.add(row)
    # Start from the effective values so a corrupt stored row is repaired.
    row.flag_threshold = flag
    row.block_threshold = block
    default_auto_block = (
        DEFAULT_AUTO_BLOCK_HIGH_RISK
        if current.auto_block_high_risk is None
        else bool(current.auto_block_high_risk)
    )
    row.auto_block_high_risk = changes.get("auto_block_high_risk", default_auto_block)
    row.email_alerts = changes.get(
        "email_alerts",
        False if current.email_alerts is None else bool(current.email_alerts),
    )
    if "updated_by" in changes:
        row.updated_by = changes["updated_by"]
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row
