import io
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.database import Base
from app.db_migrate import run_migrations, SchemaMismatchError, BACKEND_DIR
from conftest import make_engine

LEGACY_TABLES = ["transactions", "fraud_alerts", "model_performance_records"]


def legacy_engine(with_settings=False, rows=True):
    eng = make_engine()
    if with_settings:
        Base.metadata.create_all(bind=eng)
    else:
        Base.metadata.create_all(
            bind=eng, tables=[Base.metadata.tables[t] for t in LEGACY_TABLES]
        )
    if rows:
        with eng.begin() as c:
            for i in range(3):
                c.execute(text(
                    "INSERT INTO transactions (id, customer_id, amount, transaction_type, risk_score, status)"
                    " VALUES (:i, 'C', 10.0, 'P2P_TRANSFER', 5, 'APPROVED')"), {"i": f"TX-{i}"})
            c.execute(text(
                "INSERT INTO fraud_alerts (id, transaction_id, risk_score, reason)"
                " VALUES ('A1', 'TX-0', 80, 'r')"))
    return eng


def count(eng, table):
    with eng.connect() as c:
        return c.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()


def version(eng):
    with eng.connect() as c:
        return c.execute(text("SELECT version_num FROM alembic_version")).scalar()


def test_fresh_db_upgrades_to_head():
    eng = make_engine()
    assert run_migrations(eng) == "created"
    tables = set(inspect(eng).get_table_names())
    assert {"transactions", "fraud_alerts", "model_performance_records", "system_settings",
            "alembic_version"} <= tables
    assert version(eng) == "0002"
    # idempotent
    assert run_migrations(eng) == "upgraded"


def test_legacy_db_adopted_with_data_preserved():
    eng = legacy_engine()
    assert "system_settings" not in inspect(eng).get_table_names()
    assert run_migrations(eng) == "adopted"
    assert count(eng, "transactions") == 3
    assert count(eng, "fraud_alerts") == 1
    assert "system_settings" in inspect(eng).get_table_names()
    assert version(eng) == "0002"


def test_tampered_legacy_refused_and_untouched():
    eng = legacy_engine()
    with eng.begin() as c:
        c.execute(text("ALTER TABLE transactions DROP COLUMN device_type"))
    with pytest.raises(SchemaMismatchError):
        run_migrations(eng)
    tables = set(inspect(eng).get_table_names())
    assert "alembic_version" not in tables
    assert "system_settings" not in tables
    assert count(eng, "transactions") == 3


def test_legacy_missing_table_refused():
    eng = legacy_engine()
    with eng.begin() as c:
        c.execute(text("DROP TABLE model_performance_records"))
    with pytest.raises(SchemaMismatchError):
        run_migrations(eng)
    assert "alembic_version" not in inspect(eng).get_table_names()


def test_legacy_with_system_settings_present():
    eng = legacy_engine(with_settings=True)
    with eng.begin() as c:
        c.execute(text("INSERT INTO system_settings (id, flag_threshold, block_threshold,"
                       " auto_block_high_risk, email_alerts) VALUES (1, 40, 80, 1, 0)"))
    assert run_migrations(eng) == "adopted"
    assert count(eng, "transactions") == 3
    assert count(eng, "system_settings") == 1
    assert version(eng) == "0002"


def test_offline_postgresql_sql_generation():
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", "postgresql://u:p@localhost/db")
    cfg.attributes["configure_logger"] = False
    buf = io.StringIO()
    cfg.output_buffer = buf
    command.upgrade(cfg, "head", sql=True)
    sql = buf.getvalue()
    assert "CREATE TABLE transactions" in sql
    assert "CREATE TABLE system_settings" in sql
