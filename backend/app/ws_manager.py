from datetime import datetime
from typing import List
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger("fraudshield.ws")


def build_transaction_event(tx) -> dict:
    """Build a canonical NEW_TRANSACTION WebSocket event payload."""
    return {
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
            "ip_address": tx.ip_address,
            "device_type": tx.device_type,
            "timestamp": tx.timestamp.isoformat() + "Z" if tx.timestamp else None,
            "is_demo_data": bool(tx.is_demo_data),
        },
    }


def build_alert_event(alert) -> dict:
    """Build a canonical NEW_ALERT WebSocket event payload."""
    return {
        "event_type": "NEW_ALERT",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "data": {
            "id": alert.id,
            "transaction_id": alert.transaction_id,
            "severity": alert.severity,
            "risk_score": alert.risk_score,
            "reason": alert.reason,
            "status": alert.status,
            "created_at": alert.created_at.isoformat() + "Z" if alert.created_at else None,
            "is_demo_data": bool(alert.is_demo_data),
        },
    }

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        
        # Serialize once
        text_data = json.dumps(message, default=str)
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(text_data)
            except Exception as e:
                logger.warning(f"Error sending message to client: {e}")
                dead_connections.append(connection)
                
        for dead in dead_connections:
            if dead in self.active_connections:
                self.active_connections.remove(dead)

ws_manager = ConnectionManager()
