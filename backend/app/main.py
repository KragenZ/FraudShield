import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, SessionLocal
from app.seed import seed_database
from app.ws_manager import ws_manager
from app.simulator import live_transaction_simulator

# Import API routers
from app.api.health import router as health_router
from app.api.transactions import router as transactions_router
from app.api.alerts import router as alerts_router
from app.api.analytics import router as analytics_router
from app.api.model_metrics import router as model_router
from app.api.settings import router as settings_router
from app.db_migrate import run_migrations

# Background task for live stream simulation
simulator_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: migrations and seeding run automatically only when explicitly opted in.
    if settings.AUTO_MIGRATE_ON_STARTUP:
        run_migrations(engine)
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
app.include_router(settings_router, prefix=settings.API_V1_STR)

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
