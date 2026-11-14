"""Construye una base SQLite local desde los CSV (para análisis y para el backend en desarrollo).

    python data/scripts/build_db.py            -> data/db/health_monitor.sqlite (ignorado por git)

Para PostgreSQL: ejecutar data/schema.sql y cargar cada CSV con
    \\copy <tabla> FROM '<csv>' WITH (FORMAT csv, HEADER true)
en el orden de TABLES (las celdas vacías se cargan como NULL).
"""
import csv
import sqlite3
from pathlib import Path

DATA = Path(__file__).resolve().parents[1]
DB = DATA / "db" / "health_monitor.sqlite"
TABLES = [  # (tabla, csv) en orden de llaves foráneas
    ("risk_domain", "reference/risk_domains.csv"),
    ("source", "reference/sources.csv"),
    ("metric", "reference/metrics.csv"),
    ("medical_reference", "reference/medical_reference.csv"),
    ("mission", "reference/missions.csv"),
    ("crew_member", "synthetic/crew.csv"),
    ("event", "synthetic/events.csv"),
    ("measurement", "synthetic/measurements_24h.csv"),
    ("daily_measurement", "synthetic/daily_measurements.csv"),
    ("nasa_topic", "nasa/topics.csv"),
    ("nasa_experiment", "nasa/experiments.csv"),
    ("nasa_dataset", "nasa/datasets.csv"),
    ("nasa_dataset_topic", "nasa/dataset_topics.csv"),
    ("nasa_dataset_mission", "nasa/dataset_missions.csv"),
    ("nasa_dataset_experiment", "nasa/dataset_experiments.csv"),
    ("nasa_evidence_finding", "nasa/evidence_findings.csv"),
    ("nasa_dataset_metric_link", "nasa/dataset_metric_links.csv"),
]
BOOL = {"true": 1, "false": 0, "1": 1, "0": 0}


def convert(v, col_type):
    if v == "":
        return None
    if col_type == "BOOLEAN":
        return BOOL[v.lower()]
    return v


def main():
    DB.parent.mkdir(exist_ok=True)
    DB.unlink(missing_ok=True)
    con = sqlite3.connect(DB)
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript((DATA / "schema.sql").read_text(encoding="utf-8"))
    for table, rel in TABLES:
        types = {r[1]: r[2].upper() for r in con.execute(f"PRAGMA table_info({table})")}
        with (DATA / rel).open(encoding="utf-8") as f:
            rd = csv.DictReader(f)
            cols = [c for c in rd.fieldnames if c in types]
            rows = [[convert(r[c], types[c]) for c in cols] for r in rd]
        con.executemany(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", rows)
        print(f"{table:26} {len(rows):6}")
    con.commit()
    bad = con.execute("PRAGMA foreign_key_check").fetchall()
    print("llaves foráneas rotas:", len(bad))
    con.close()
    print(f"-> {DB}")


if __name__ == "__main__":
    main()
