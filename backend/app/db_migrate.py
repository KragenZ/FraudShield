"""Safe database migration runner.

Behaviour:
- Fresh database (no tables)              -> alembic upgrade head.
- Database already managed by Alembic     -> alembic upgrade head.
- Legacy database (tables from create_all, no alembic_version)
                                          -> verify its schema matches the 0001 baseline
                                             exactly; ONLY then stamp 0001 and upgrade.
                                             On mismatch, raise and leave the DB untouched.
"""
import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool

logger = logging.getLogger("fraudshield.migrate")

BACKEND_DIR = Path(__file__).resolve().parent.parent
BASELINE_REVISION = "0001"


class SchemaMismatchError(RuntimeError):
    pass


def _config(connection) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.attributes["connection"] = connection
    cfg.attributes["configure_logger"] = False
    return cfg


def _describe(engine_or_conn, tables) -> dict:
    insp = inspect(engine_or_conn)
    out = {}
    for t in tables:
        cols = {c["name"]: (type(c["type"]).__name__.upper(), bool(c["nullable"])) for c in insp.get_columns(t)}
        idx = {i["name"]: tuple(i["column_names"]) for i in insp.get_indexes(t)}
        fks = {(tuple(f["constrained_columns"]), f["referred_table"]) for f in insp.get_foreign_keys(t)}
        pk = tuple(insp.get_pk_constraint(t)["constrained_columns"])
        out[t] = {"columns": cols, "indexes": idx, "fks": fks, "pk": pk}
    return out


def baseline_schema_description() -> dict:
    """Apply revision 0001 to a throwaway in-memory DB and describe it."""
    mem = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    with mem.begin() as conn:
        command.upgrade(_config(conn), BASELINE_REVISION)
    tables = [t for t in inspect(mem).get_table_names() if t != "alembic_version"]
    return _describe(mem, tables)


def verify_legacy_schema(engine: Engine) -> None:
    expected = baseline_schema_description()
    existing_tables = set(inspect(engine).get_table_names())
    missing = set(expected) - existing_tables
    if missing:
        raise SchemaMismatchError(f"Legacy database is missing baseline tables: {sorted(missing)}")
    actual = _describe(engine, list(expected))
    problems = []
    for table, exp in expected.items():
        act = actual[table]
        if exp["columns"].keys() != act["columns"].keys():
            problems.append(f"{table}: columns differ ({sorted(exp['columns'])} vs {sorted(act['columns'])})")
        if {k: v[1] for k, v in exp["columns"].items()} != {k: v[1] for k, v in act["columns"].items()}:
            problems.append(f"{table}: column nullability differs")
        if exp["fks"] != act["fks"]:
            problems.append(f"{table}: foreign keys differ")
        if exp["pk"] != act["pk"]:
            problems.append(f"{table}: primary key differs")
        if set(exp["indexes"].values()) != set(act["indexes"].values()):
            problems.append(f"{table}: indexes differ")
    if problems:
        raise SchemaMismatchError("Refusing to stamp legacy database: " + "; ".join(problems))


def _stamped_empty(conn) -> bool:
    # A DB stamped at base (no version row) is legitimately empty.
    return conn.exec_driver_sql("SELECT COUNT(*) FROM alembic_version").scalar() == 0


def run_migrations(engine: Engine) -> str:
    """Bring the database to the latest revision. Returns a short description of what happened."""
    tables = set(inspect(engine).get_table_names())
    with engine.begin() as conn:
        cfg = _config(conn)
        if "alembic_version" in tables:
            if not ({"transactions", "fraud_alerts"} <= tables) and not _stamped_empty(conn):
                raise SchemaMismatchError("alembic_version exists but baseline tables are missing; refusing to migrate")
            command.upgrade(cfg, "head")
            return "upgraded"
        if not tables:
            command.upgrade(cfg, "head")
            return "created"
    # Legacy create_all() database: verify before adopting.
    verify_legacy_schema(engine)
    with engine.begin() as conn:
        cfg = _config(conn)
        command.stamp(cfg, BASELINE_REVISION)
        command.upgrade(cfg, "head")
    logger.info("Adopted verified legacy database into Alembic")
    return "adopted"
