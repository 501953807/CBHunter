"""SQLite maintenance script regression tests."""

import sqlite3
from pathlib import Path

from scripts.db_maintenance import backup_database, check_database, database_stats


def test_sqlite_maintenance_check_stats_and_backup(tmp_path: Path):
    database = tmp_path / "source.db"
    with sqlite3.connect(str(database)) as connection:
        connection.execute("CREATE TABLE example (id INTEGER PRIMARY KEY, name TEXT)")
        connection.execute("INSERT INTO example (name) VALUES ('real row')")
        connection.commit()

    checked = check_database(database)
    assert checked["integrity_ok"] is True
    assert checked["foreign_key_violations"] == 0
    assert database_stats(database)["rows"]["example"] == 1

    backup = backup_database(database, tmp_path / "backups", "test")
    assert backup.is_file()
    assert database_stats(backup)["rows"]["example"] == 1
