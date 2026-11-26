import asyncio
import random
import uuid
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.seed import seed_database
from app.ws_manager import ws_manager
from app.models import Transaction, FraudAlert, TransactionType, TransactionStatus, AlertSeverity, AlertStatus

# Import API routers
from app.api.health import router as health_router
from app.api.transactions import router as transactions_router
from app.api.alerts import router as alerts_router
from app.api.analytics import router as analytics_router
from app.api.model_metrics import router as model_router

# Background task for live stream simulation
simulator_task = None

async def live_transaction_simulator():
    """
    Periodically injects a realistic transaction to simulate a live bank or payment gateway feed,
    demonstrating real-time WebSocket updates to the frontend dashboard.
    """
    await asyncio.sleep(5)  # initial delay
    merchants = ["Uber Technologies", "Amazon Cloud", "Coinbase Direct", "Target Store #102", "TransferWise P2P", "Stripe Charge"]
    customers = [
        ("CUST-9102", "Elena Rostova", "New York, USA"),
        ("CUST-4421", "Marcus Vance", "London, UK"),
        ("CUST-1098", "Aria Takahashi", "Tokyo, Japan"),
        ("CUST-7723", "David Chen", "Singapore, SG")
    ]
    types = [TransactionType.ONLINE_PURCHASE.value, TransactionType.P2P_TRANSFER.value, TransactionType.WIRE_TRANSFER.value, TransactionType.MERCHANT_PAYMENT.value]

    while True:
        try:
            await asyncio.sleep(settings.SIMULATION_INTERVAL_SECONDS)
            if not ws_manager.active_connections:
                continue

            db: Session = SessionLocal()
            try:
                cust = random.choice(customers)
                t_type = random.choice(types)
                merch = random.choice(merchants)
                
                # Mostly normal, occasionally high risk
                is_fraud = random.random() < 0.18
                if is_fraud:
                    risk_score = random.randint(78, 96)
                    amount = round(random.uniform(3500.0, 18500.0), 2)
                    status = TransactionStatus.FLAGGED.value if risk_score < 88 else TransactionStatus.BLOCKED.value
                else:
                    risk_score = random.randint(3, 30)
                    amount = round(random.uniform(15.0, 750.0), 2)
                    status = TransactionStatus.APPROVED.value

                tx_id = f"TX-{uuid.uuid4().hex[:8].upper()}"
                tx = Transaction(
                    id=tx_id,
                    customer_id=cust[0],
                    customer_name=cust[1],
                    amount=amount,
                    currency="USD",
                    transaction_type=t_type,
                    timestamp=datetime.utcnow(),
                    fraud_probability=round(risk_score / 100.0, 3),
                    risk_score=risk_score,
                    status=status,
                    merchant=merch,
                    location=cust[2],
                    ip_address="192.168.1.1",
                    device_type="Web Browser",
                    is_demo_data=True
                )
                db.add(tx)

                alert_obj = None
                if is_fraud:
                    severity = AlertSeverity.CRITICAL.value if risk_score >= 88 else AlertSeverity.HIGH.value
                    alert_obj = FraudAlert(
                        id=f"ALT-{uuid.uuid4().hex[:8].upper()}",
                        transaction_id=tx_id,
                        severity=severity,
                        risk_score=risk_score,
                        reason=f"Real-time heuristic: High risk score {risk_score} detected for ${amount:,.2f} {t_type}.",
                        status=AlertStatus.NEW.value,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                        is_demo_data=True
                    )
                    db.add(alert_obj)

                db.commit()

                # Broadcast transaction event
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
                        "is_demo_data": True
                    }
                })

                if alert_obj:
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
                            "is_demo_data": True
                        }
                    })
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            await asyncio.sleep(2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed initial data
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db, force=False)
    finally:
        db.close()

    global simulator_task
    if settings.ENABLE_LIVE_SIMULATOR:
        simulator_task = asyncio.create_task(live_transaction_simulator())
        
    yield

    # Shutdown
    if simulator_task:
        simulator_task.cancel()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-grade real-time financial fraud detection & risk analytics backend API.",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health_router, prefix=settings.API_V1_STR)
app.include_router(transactions_router, prefix=settings.API_V1_STR)
app.include_router(alerts_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(model_router, prefix=settings.API_V1_STR)

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial confirmation message
        await websocket.send_json({
            "event_type": "CONNECTED",
            "message": "Connected to FraudShield AI Real-Time WebSocket Feed",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
        while True:
            # Keep receiving client heartbeats or custom filters
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
