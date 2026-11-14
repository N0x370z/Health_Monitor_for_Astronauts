# Data

Database for the Health Monitor. It combines three layers:

1. **Medical reference (the core)**: clinical ranges and alert thresholds per metric and mission context, each row with its source.
2. **Synthetic crew data**: anonymous crews on three simulated missions, calibrated with layer 1, with labelled anomalies.
3. **NASA LSDA evidence**: the real, public NASA Life Sciences Data Archive catalog, cleaned and normalized, plus the published results of 455 experiments.

> No personal data. Crew members are codes (`CREW-LEO-01`) with no name, age or identifiers. Real human data from NASA is only used as published, aggregated results.

## Why synthetic data?

Continuous physiological data from real astronauts is privacy-protected (NASA releases it only through a formal data request). The public archive does contain **aggregated results** (for example *"Skylab 3 and 4 crewmembers suffered bone mineral mass losses ranging from 4.5 to 7.4 percent"*). We use those results together with clinical guidelines to define realistic ranges, and generate time series from them.

## Risk domains (NASA's 5 hazards of human spaceflight)

| Code | Domain | Example metrics |
|---|---|---|
| `RAD` | Space radiation | `radiation_dose_rate`, `dose_rate_spike_ratio`, `radiation_dose_career` |
| `ISO` | Isolation and confinement | `sleep_duration`, `pvt_mean_rt`, `phq9_score`, `gad7_score`; stress: `pss10_score`, `urinary_cortisol`, `hrv_rmssd` |
| `DIST` | Distance from Earth | `comm_delay_one_way`, `body_mass_change_pct_month` (food supply) |
| `GRAV` | Altered gravity | heart: `heart_rate`, `systolic_bp`, `hr_orthostatic_increase`; bone: `bmd_change_pct_month`, `urinary_calcium`; muscle: `muscle_strength_change_pct`, `muscle_volume_change_pct`; inner ear: `motion_sickness_score`, `sot_equilibrium_score` |
| `ENV` | Hostile, closed environment | `cabin_co2`, `cabin_o2`, `cabin_temp`, `cabin_pressure`, `cabin_nh3`, `illumination`, `spo2`, `body_temp` |

> **CSV files are not versioned** (`data/**/*.csv` is git-ignored). The layout below shows where they go locally. `generate_synthetic.py` and `reference_rows.py` recreate `synthetic/` and `medical_reference.csv`. The other reference tables and `nasa/` must be shared separately; they are also in the history of commits `4a58c51` and `211a32e` (`git checkout 211a32e -- data/nasa data/reference`).

## Layout

```text
data/
├── schema.sql                 # normalized schema (PostgreSQL / SQLite)
├── queries.sql                # example queries: radiation, palpitations, sleep, evidence...
├── reference/                 # 1. medical reference
│   ├── medical_reference.csv  #    ★ ranges + thresholds per metric/context (58 rows)
│   ├── metrics.csv            #    metric dictionary (41 metrics, unit, domain, sampling)
│   ├── risk_domains.csv       #    RAD / ISO / DIST / GRAV / ENV
│   ├── sources.csv            #    citations (guidelines, papers, NASA LSDA experiments)
│   └── missions.csv           #    simulated missions: LEO, Moon, Mars transit, return to Earth
├── synthetic/                 # 2. synthetic data (regenerable)
│   ├── crew.csv               #    16 anonymous crew members + baselines
│   ├── measurements_24h.csv   #    last 24 h every 5 min (vitals, cabin, radiation)
│   ├── daily_measurements.csv #    mission history (sleep, bone, muscle, mood, dose...)
│   └── events.csv             #    injected anomalies = ground truth
├── nasa/                      # 3. NASA LSDA evidence (real, public)
│   ├── datasets.csv           #    2,390 datasets (flags: public, aggregated, machine-readable)
│   ├── experiments.csv        #    455 experiments with objectives / approach / results
│   ├── evidence_findings.csv  #    1,805 result sentences linked to domain + metric
│   ├── dataset_metric_links.csv
│   └── topics.csv, dataset_topics.csv, dataset_missions.csv, dataset_experiments.csv
└── scripts/
    ├── reference_rows.py      # source of truth for medical_reference.csv
    ├── generate_synthetic.py  # synthetic generator (stdlib only)
    ├── normalize_nasa.py      # rebuilds nasa/ from the cleaned catalog (needs pandas)
    ├── build_db.py            # builds data/db/health_monitor.sqlite (git-ignored)
    └── inspect_db.py          # requirement checks + HTML report with charts (needs matplotlib)
```

## Alert rule

Every measurement gets a `status` computed against `medical_reference.csv`:

```text
critical  if value <= critical_low  or value >= critical_high
warning   if value <  normal_min    or value >  normal_max
normal    otherwise                       (empty bound = no limit on that side)
```

The reference row is chosen by context, most specific first: mission environment (`leo`, `lunar_surface`, `mars_transit`) → `microgravity` → activity/period (`exercise`, `work_period`, `sleep_period`) → `crew_cabin` → `post_landing` → `any`.
Each row has a `confidence` (`high`, `medium`, `needs_verification`). Thresholds marked `SRC_PROJECT` are project heuristics, not validated clinical values.

## Synthetic missions and injected events

| Mission | Context | Day | Injected events |
|---|---|---|---|
| `SIM-LEO` | ISS-like low Earth orbit (0 g) | 120/180 | tachycardia episode (EVT01), CO₂ scrubber degradation (EVT02), missed exercise → bone and muscle loss + hypercalciuria (EVT08), spacewalk workload stress: high cortisol, low HRV (EVT12) |
| `SIM-MOON` | Lunar surface base (1/6 g) | 12/30 | ammonia leak (EVT05), slow cabin leak (EVT06), adapting to 1/6 g: orthostatic intolerance and low balance score (EVT11) |
| `SIM-MARS` | Mars transit (0 g) | 95/210 | solar particle event (EVT03), respiratory infection with fever and low SpO₂ (EVT04), isolation → poor sleep, mood and stress (EVT07), weight loss (EVT09) |
| `SIM-RETURN` | Back on Earth after 6 months in orbit (1 g) | 7/21 | re-adaptation to 1 g: orthostatic intolerance, low balance, motion sickness, muscle recovery (EVT13) |

Space motion sickness on days 1–3 (EVT10), re-adaptation after landing (EVT13) and the South Atlantic Anomaly passes in LEO are expected phenomena, not failures.
`is_injected_anomaly` + `event_id` let you measure how many anomalies an alert or ML detector catches (see query 7 in `queries.sql`).

Known, intentional behaviour: average sleep is ~6 h, which matches what NASA actigraphy measured in flight. It is below the ≥7 h clinical recommendation, so many nights show as `warning`.

## Usage

```bash
# Rebuild everything (from the repo root)
python data/scripts/reference_rows.py
python data/scripts/generate_synthetic.py --end 2026-11-14T12:00:00Z   # use the current UTC time for a fresh "last 24 h"
python data/scripts/build_db.py                                         # -> data/db/health_monitor.sqlite
sqlite3 data/db/health_monitor.sqlite < data/queries.sql

pip install -r data/requirements.txt
python data/scripts/inspect_db.py       # checks 15 requirements and opens data/db/report.html
```

`inspect_db.py` checks the requirements below. It exits with code 1 if any of them fails, so it can run in CI:

- the 5 risk domains
- radiation (rate, spikes, cumulative dose, limits)
- muscle, bone and kidney, inner ear, heart
- adaptation to 0 g, 1/6 g and 1 g
- physiological and psychological stress
- last 24 h at 5-min resolution
- a referenced range for every metric
- status consistency
- no personal data
- integrity
- anomaly detection

The report charts radiation, heart rate, muscle and bone, inner ear and gravity adaptation, stress, cabin environment and alerts.

PostgreSQL: run `schema.sql`, then load each CSV with `\copy <table> FROM '<csv>' WITH (FORMAT csv, HEADER true)` in the order listed in `scripts/build_db.py`.

`normalize_nasa.py` needs the cleaned NASA catalog folder (`--src`), which is not part of the repo. Its outputs in `nasa/` are committed, so you only need it to refresh them.

## Sources and limitations

- Clinical thresholds: NEWS2 (vital signs), ACC/AHA 2017 (blood pressure), AASM/SRS (sleep), PHQ-9 / GAD-7 / PSS-10, HRV norms (Shaffer 2017), ACSM (exercise), orthostatic consensus (Freeman 2011), NIOSH/OSHA/EPA (cabin air and noise).
- Space-specific values: MSL/RAD (Mars transit 1.84 mSv/day, Mars surface 0.64), Chang'e 4 (Moon 1.37 mSv/day), NASA-STD-3001 (600 mSv career limit), LeBlanc 2000 (bone loss).
- Evidence: NASA Life Sciences Data Archive via the NASA Life Sciences Portal (https://nlsp.nasa.gov), public records only.
- Rows marked `needs_verification` (cabin CO₂, temperature, humidity, pressure, 30-day/1-year dose limits) must be checked against the current NASA-STD-3001 revision before relying on them.
- This is an educational prototype, not a medical device.
