#!/usr/bin/env python3
"""SQLite integrity, statistics and online backup utility.

Usage:
    cd backend
    venv/bin/python scripts/db_maintenance.py check
    venv/bin/python scripts/db_maintenance.py stats
    venv/bin/python scripts/db_maintenance.py backup
"""

import argparse
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

DEFAULT_DB = Path(__file__).resolve().parents[1] / "data" / "shop.db"
DEFAULT_BACKUP_DIR = Path(__file__).resolve().parents[1] / "data" / "backups"


def check_database(database: Path) -> dict:
    _require_database(database)
    with sqlite3.connect(str(database)) as connection:
        integrity = connection.execute("PRAGMA integrity_check").fetchall()
        foreign_keys = connection.execute("PRAGMA foreign_key_check").fetchall()
    return {
        "database": str(database),
        "integrity_ok": integrity == [("ok",)],
        "integrity_messages": [row[0] for row in integrity],
        "foreign_key_violations": len(foreign_keys),
        "foreign_key_details": [list(row) for row in foreign_keys],
    }


def database_stats(database: Path) -> dict:
    _require_database(database)
    with sqlite3.connect(str(database)) as connection:
        tables = [
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
        ]
        counts = {}
        for table in tables:
            safe_name = table.replace('"', '""')
            counts[table] = connection.execute(f'SELECT COUNT(*) FROM "{safe_name}"').fetchone()[0]
        page_count = connection.execute("PRAGMA page_count").fetchone()[0]
        page_size = connection.execute("PRAGMA page_size").fetchone()[0]
    return {
        "database": str(database),
        "tables": len(tables),
        "rows": counts,
        "database_bytes": page_count * page_size,
    }


def backup_database(database: Path, destination_dir: Path, label: Optional[str] = None) -> Path:
    _require_database(database)
    destination_dir.mkdir(parents=True, exist_ok=True)
    suffix = label or datetime.now().strftime("%Y%m%d-%H%M%S")
    destination = destination_dir / f"{database.stem}-{suffix}.db"
    if destination.exists():
        raise FileExistsError(f"Backup already exists: {destination}")
    with sqlite3.connect(str(database)) as source, sqlite3.connect(str(destination)) as target:
        source.backup(target)
    result = check_database(destination)
    if not result["integrity_ok"] or result["foreign_key_violations"]:
        destination.unlink(missing_ok=True)
        raise RuntimeError("Backup verification failed")
    return destination


def _require_database(database: Path) -> None:
    if not database.is_file():
        raise FileNotFoundError(f"Database not found: {database}")


def main() -> int:
    parser = argparse.ArgumentParser(description="CBHunter SQLite maintenance")
    parser.add_argument("action", choices=("check", "stats", "backup"))
    parser.add_argument("--database", type=Path, default=DEFAULT_DB)
    parser.add_argument("--backup-dir", type=Path, default=DEFAULT_BACKUP_DIR)
    parser.add_argument("--label")
    args = parser.parse_args()

    if args.action == "check":
        result = check_database(args.database)
    elif args.action == "stats":
        result = database_stats(args.database)
    else:
        destination = backup_database(args.database, args.backup_dir, args.label)
        result = {"database": str(args.database), "backup": str(destination)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
