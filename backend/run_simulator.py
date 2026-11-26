"""Standalone CLI runner for the FraudShield AI synthetic transaction simulator."""
import logging
import os
import signal
import sys
import threading

# Ensure backend root is in sys.path when invoked directly.
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.config import settings
from app.database import SessionLocal
from app.simulator import generate_simulated_transaction

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("fraudshield.simulator.cli")


def main() -> int:
    stop_event = threading.Event()

    def _handle_shutdown(signum, _frame):
        logger.info("Received signal %s; shutting down simulator...", signum)
        stop_event.set()

    signal.signal(signal.SIGINT, _handle_shutdown)
    signal.signal(signal.SIGTERM, _handle_shutdown)

    interval = max(1, int(settings.SIMULATION_INTERVAL_SECONDS))
    logger.info("Starting standalone transaction simulator (interval=%ss)", interval)

    try:
        while not stop_event.is_set():
            db = SessionLocal()
            try:
                tx, alert_obj = generate_simulated_transaction(db)
                logger.info(
                    "Generated %s (%s, score=%d, amount=%.2f%s)",
                    tx.id,
                    tx.status,
                    tx.risk_score,
                    tx.amount,
                    f", alert={alert_obj.id}/{alert_obj.severity}" if alert_obj else "",
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Simulator iteration failed: %s", exc, exc_info=True)
            finally:
                db.close()

            stop_event.wait(interval)
    except KeyboardInterrupt:
        logger.info("Simulator interrupted; exiting cleanly.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
