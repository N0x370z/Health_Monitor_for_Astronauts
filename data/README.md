# Data

Database of the Health Monitor: **`data/health_monitor.sqlite`**. The file is versioned, so you can query it directly.

**Scope:** temperature (body and cabin), pressure (cabin and blood pressure), cardiovascular function, oxygen saturation (SpO₂) and space radiation.

The database has three layers:

1. **Medical reference (the core):** normal and critical ranges per metric and mission context. Every row has a cited source.
2. **Synthetic crew and cabin data:** anonymous crews on four simulated missions, calibrated with layer 1, with labelled anomalies.
3. **NASA LSDA evidence:** real, public metadata and published results from the NASA Life Sciences Data Archive related to the scope.

> No personal data. Crew members are codes (`CREW-LEO-01`). All time series are synthetic.
> Sources and citations are in [`docs/DATA_SOURCES.md`](../docs/DATA_SOURCES.md); the full method is in [`docs/DATA_METHODOLOGY.md`](../docs/DATA_METHODOLOGY.md).

## Metrics (14)

| Area | Metric | Unit | Sampling |
|---|---|---|---|
| Temperature | `body_temp`, `cabin_temp` | °C | 5 min |
| Pressure | `cabin_pressure` | kPa | 5 min |
| Cardiovascular / blood pressure | `heart_rate` | bpm | 5 min |
| | `systolic_bp`, `diastolic_bp` | mmHg | 5 min + daily mean |
| | `hr_orthostatic_increase`, `sbp_orthostatic_drop` | bpm, mmHg | daily, after a change of gravity |
| Oxygen saturation | `spo2` | % | 5 min |
| Radiation | `radiation_dose_rate` | mSv/day | 5 min |
| | `dose_rate_spike_ratio` | ratio | 5 min |
| | `radiation_dose_30d`, `radiation_dose_365d`, `radiation_dose_career` | mSv | daily |

## Tables

| Group | Tables |
|---|---|
| Medical reference | `risk_domain`, `source`, `metric`, `medical_reference`, `mission` |
| Synthetic data | `crew_member`, `measurement` (last 24 h every 5 min), `daily_measurement` (mission history), `event` (injected anomalies) |
| NASA evidence | `nasa_dataset`, `nasa_experiment`, `nasa_evidence_finding`, `nasa_dataset_metric_link`, `nasa_topic`, `nasa_dataset_topic`, `nasa_dataset_mission`, `nasa_dataset_experiment` |
| Views | `v_alerts_24h`, `v_metric_evidence` |

## Alert rule

```text
critical  if value <= critical_low  or value >= critical_high
warning   if value <  normal_min    or value >  normal_max
normal    otherwise                       (empty bound = no limit on that side)
```

The reference row is chosen by context, most specific first: mission environment (`leo`, `lunar_surface`, `mars_transit`, `post_landing`) → `earth` → activity (`exercise`, `daily_mean`) → `crew_cabin` → `post_landing` → `any`.
`confidence` is `high`, `medium` or `needs_verification`. Thresholds from `SRC_PROJECT` are project heuristics.

## Simulated missions and injected events

| Mission | Environment | Day | Injected events |
|---|---|---|---|
| `SIM-LEO` | ISS-like low Earth orbit (0 g) | 120/180 | tachycardia at rest (EVT01), thermal control failure (EVT05), rising blood pressure (EVT08) |
| `SIM-MOON` | Lunar surface base (1/6 g) | 12/30 | slow cabin leak (EVT04), orthostatic intolerance on arrival (EVT06) |
| `SIM-MARS` | Mars transit (0 g) | 95/210 | solar particle event (EVT02), respiratory infection with fever and low SpO₂ (EVT03) |
| `SIM-RETURN` | Earth after 6 months in orbit (1 g) | 7/21 | re-adaptation to 1 g (EVT07) |

South Atlantic Anomaly passes in low Earth orbit and the re-adaptation after landing are expected phenomena, not failures. Use `is_injected_anomaly` and `event_id` to measure how many anomalies an alert or ML detector catches (query 9 in `queries.sql`).

## Layout

```text
data/
├── health_monitor.sqlite      # ★ the database (versioned)
├── schema.sql                 # normalized schema (PostgreSQL / SQLite)
├── queries.sql                # example queries: radiation, heart rate, blood pressure, temperature, SpO2, pressure
├── requirements.txt
└── scripts/
    ├── reference_data.py      # medical reference tables (source of truth)
    ├── generate_synthetic.py  # synthetic crew and cabin data (standard library only)
    ├── normalize_nasa.py      # NASA LSDA tables from the cleaned catalog (needs pandas)
    ├── build_db.py            # builds data/health_monitor.sqlite
    └── inspect_db.py          # requirement checks + HTML report (needs matplotlib)
```

Intermediate CSV files (`reference/`, `synthetic/`, `nasa/`) and the report (`db/`) are generated locally and git-ignored.

## Usage

```bash
sqlite3 data/health_monitor.sqlite < data/queries.sql      # query the database as is

pip install -r data/requirements.txt
python data/scripts/build_db.py                            # rebuild (keeps the nasa_* tables if data/nasa/ is absent)
python data/scripts/inspect_db.py                          # 15 requirement checks + opens data/db/report.html
```

To refresh the last 24 hours, run `python data/scripts/generate_synthetic.py --end <current UTC time>` and then `build_db.py`. By default the window ends at `2026-11-14T12:00:00Z`.

PostgreSQL: run `schema.sql`, then load each CSV with `\copy <table> FROM '<csv>' WITH (FORMAT csv, HEADER true)` in the order of `TABLES` in `scripts/build_db.py`.
