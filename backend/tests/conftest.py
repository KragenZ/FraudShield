import os
import sys
from pathlib import Path

# Must be set before the app is imported.
os.environ["ENABLE_LIVE_SIMULATOR"] = "false"
os.environ["DATABASE_URL"] = "sqlite://"  # never touch the real fraudshield.db

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import uuid  # noqa: E402
from datetime import datetime  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database import Base, get_db  # noqa: E402
from app import models  # noqa: E402,F401
from app.main import app  # noqa: E402


def make_engine():
    return create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )


@pytest.fixture()
def engine():
    eng = make_engine()
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def session_factory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db(session_factory):
    s = session_factory()
    yield s
    s.close()


@pytest.fixture()
def client(session_factory):
    def _override():
        s = session_factory()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _override
    # No context manager: lifespan (real engine, seeding) must not run in tests.
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_tx(db, *, amount=100.0, ttype="ONLINE_PURCHASE", status="APPROVED", ts=None, risk=10, **kw):
    tx = models.Transaction(
        id=kw.pop("id", f"TX-{uuid.uuid4().hex[:8].upper()}"),
        customer_id=kw.pop("customer_id", "CUST-1"),
        customer_name=kw.pop("customer_name", "Test Customer"),
        amount=amount,
        currency="USD",
        transaction_type=ttype,
        timestamp=ts or datetime(2025, 11, 20, 12, 0),
        fraud_probability=risk / 100.0,
        risk_score=risk,
        status=status,
        merchant=kw.pop("merchant", "Shop"),
        location=kw.pop("location", "Somewhere"),
        ip_address="127.0.0.1",
        device_type="Web",
        is_demo_data=True,
    )
    db.add(tx)
    db.commit()
    return tx


def make_alert(db, tx_id, *, severity="HIGH", status="NEW", created_at=None, aid=None, risk=80):
    a = models.FraudAlert(
        id=aid or f"ALT-{uuid.uuid4().hex[:8].upper()}",
        transaction_id=tx_id,
        severity=severity,
        risk_score=risk,
        reason="test",
        status=status,
        created_at=created_at or datetime(2025, 11, 20, 12, 0),
        updated_at=datetime(2025, 11, 20, 12, 0),
        is_demo_data=True,
    )
    db.add(a)
    db.commit()
    return a
