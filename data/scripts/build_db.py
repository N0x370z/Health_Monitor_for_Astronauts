"""Construye la base de datos del monitor -> data/health_monitor.sqlite (versionada en el repo).

    python data/scripts/build_db.py

Pasos:
  1. reference_data.py      -> data/reference/*.csv
  2. generate_synthetic.py  -> data/synthetic/*.csv
  3. carga schema.sql + todos los CSV (los CSV no se versionan)
Las tablas nasa_* se cargan desde data/nasa/*.csv (generados por normalize_nasa.py). Si esos CSV no existen,
se conservan las tablas nasa_* de la base actual, así la base se puede reconstruir solo con el repo.

PostgreSQL: ejecutar data/schema.sql y cargar cada CSV con
    \\copy <tabla> FROM '<csv>' WITH (FORMAT csv, HEADER true)
en el orden de TABLES (las celdas vacías se cargan como NULL).
"""
import csv
import sqlite3
import subprocess
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parents[1]
SCRIPTS = DATA / "scripts"
DB = DATA / "health_monitor.sqlite"
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
    return BOOL[v.lower()] if col_type == "BOOLEAN" else v


def main():
    for script in ("reference_data.py", "generate_synthetic.py"):
        subprocess.run([sys.executable, str(SCRIPTS / script)], check=True)
    tmp = DB.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    con = sqlite3.connect(tmp)
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript((DATA / "schema.sql").read_text(encoding="utf-8"))
    nasa_from_db = not (DATA / "nasa" / "datasets.csv").exists()
    if nasa_from_db:
        if not DB.exists():
            sys.exit("Faltan data/nasa/*.csv y no hay base previa: ejecuta normalize_nasa.py (ver docs/DATA_SOURCES.md).")
        con.execute("ATTACH DATABASE ? AS old", (str(DB),))
    for table, rel in TABLES:
        if table.startswith("nasa_") and nasa_from_db:
            con.execute(f"INSERT INTO {table} SELECT * FROM old.{table}")
            n = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            print(f"{table:26} {n:6}  (conservada de la base anterior)")
            continue
        types = {r[1]: r[2].upper() for r in con.execute(f"PRAGMA table_info({table})")}
        with (DATA / rel).open(encoding="utf-8") as f:
            rd = csv.DictReader(f)
            cols = [c for c in rd.fieldnames if c in types]
            rows = [[convert(r[c], types[c]) for c in cols] for r in rd]
        con.executemany(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", rows)
        print(f"{table:26} {len(rows):6}")
    con.commit()
    if nasa_from_db:
        con.execute("DETACH DATABASE old")
    bad = con.execute("PRAGMA foreign_key_check").fetchall()
    con.execute("VACUUM")
    con.close()
    if bad:
        tmp.unlink()
        sys.exit(f"llaves foráneas rotas: {len(bad)}")
    tmp.replace(DB)
    print(f"llaves foráneas rotas: 0\n-> {DB} ({DB.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
