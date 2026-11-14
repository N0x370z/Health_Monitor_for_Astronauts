# Data Methodology and Work Record

Formal record of how the project database (`data/health_monitor.sqlite`) was built: objective, method, decisions, validation and limitations. Sources and citations are listed in [`DATA_SOURCES.md`](DATA_SOURCES.md).

---

## 1. Objective

The goal is a database the Health Monitor dashboard can query (`GET /api/metrics/last-24h`) to show crew health and cabin conditions and to raise alerts **before** a problem becomes serious. It must:

- cover **temperature, pressure, cardiovascular function, oxygen saturation and radiation**;
- base every alert threshold on a cited clinical or scientific source;
- contain no personal data;
- be reproducible from the repository.

## 2. Why synthetic data

Continuous physiological records of real astronauts are privacy-protected and are released by NASA only through a formal data request. Public records do contain **aggregated, published results**: group means, percentages, ranges. The chosen method was therefore:

1. Use real public sources (NASA LSDA results and clinical guidelines) to define normal and critical ranges.
2. Generate synthetic, anonymous time series from those ranges.
3. Inject labelled anomalies, so that alert logic can be tested against a known ground truth.

## 3. Method

### Phase 1. Catalog cleaning
- **Input:** `by_topic` CSV export of the LSDA catalog (13 files, 2,593 rows in `datasets_all.csv`).
- **Columns removed:** administrative columns not related to health (`dataset_catalog`, `experiment_id`, `availability`, `processing_level`, `file_name`, `file_format`, `file_size`, `release_date`). `nlsp_url` was kept for traceability.
- **Text cleaning:** removed HTML entities and tags; normalized placeholder values (`not_applicible`, `Not applicable`) to empty and species names (`Human (Homo sapiens)` → `Human`).
- **Topic tagging:** 520 rows had no `health_topics`. They were classified with keyword rules into health topics; rows with no health relation were removed.
- **Result:** 2,390 health-related datasets.

### Phase 2. Enrichment through the NASA Life Sciences Portal
- Read the public JSON record of each of the 2,390 `nlsp_url` links (all HTTP 200). Requests were throttled to about 5 per second.
- Read the 2,676 public experiment records, which include objectives, approach and results.
- Linked datasets to experiments by `experiment_id`: 455 experiments were linked and 438 of them have a published results section.
- For the 17 experiments without results, two fallbacks were used: result sentences from their own datasets, or the most similar experiment with results (TF-IDF cosine similarity).
- **Not possible:** downloading the raw data files, because the API does not expose their keys. Privacy-protected data was not requested.

### Phase 3. Evidence extraction
- Split the results sections into sentences and kept those that report a finding (increase, decrease, significance, percentages).
- Linked each finding to a monitor metric with keyword rules, and flagged findings that contain numbers.

### Phase 4. Medical reference table (core of the database)
- One row per metric and context: Earth, low Earth orbit, lunar surface, Mars transit, Mars surface, exercise, post-landing, crew cabin.
- Each row stores `normal_min`, `normal_max`, `critical_low`, `critical_high`, the expected spaceflight value, its primary source, an optional NASA evidence source, and a confidence level.
- Alert rule used everywhere:

```text
critical  if value <= critical_low  or value >= critical_high
warning   if value <  normal_min    or value >  normal_max
normal    otherwise
```

- Context resolution, most specific first: mission environment → `earth` (1 g) → activity (`exercise`, `daily_mean`) → `crew_cabin` → `post_landing` → `any`.
- **Adaptations, documented in each row:**
  - Heart rate `normal_min` is 45 bpm instead of the NEWS2 value of 51 bpm, to cover trained crew during sleep.
  - Systolic `normal_min`/`normal_max` are 100/179 mmHg for healthy adults. The NEWS2 critical limits (≤90, ≥220) were kept.
  - The exercise context avoids false alarms during the daily countermeasure session.

### Phase 5. Synthetic data generation
- **Missions:**

  | Mission | Environment | Gravity | Day of mission |
  |---|---|---|---|
  | `SIM-LEO` | ISS-like low Earth orbit | 0 g | 120/180 |
  | `SIM-MOON` | Lunar surface base | 1/6 g | 12/30 |
  | `SIM-MARS` | Mars transit | 0 g | 95/210 |
  | `SIM-RETURN` | Earth, after 6 months in orbit | 1 g | 7/21 |

- **Crew:** 16 pseudonymous members, 4 per mission. Each has random baselines for heart rate, blood pressure, temperature and prior career dose.
- **Last 24 h, every 5 minutes:**
  - Crew: heart rate, systolic and diastolic pressure, body temperature, SpO₂. The model includes a circadian rhythm, a sleep schedule (22:00–06:00 GMT) and a one-hour exercise block per crew member.
  - Module: radiation dose rate, spike ratio, cabin temperature, cabin pressure. Low Earth orbit includes about 6 South Atlantic Anomaly passes per day.
- **Mission history:** daily mean blood pressure, orthostatic tests after a change of gravity, and cumulative 30-day, 1-year and career radiation dose.
- **Injected anomalies (ground truth):**

  | Event | Mission | Description |
  |---|---|---|
  | EVT01 | SIM-LEO | Tachycardia episode at rest |
  | EVT02 | SIM-MARS | Solar particle event |
  | EVT03 | SIM-MARS | Respiratory infection: fever and low SpO₂ |
  | EVT04 | SIM-MOON | Slow cabin leak |
  | EVT05 | SIM-LEO | Thermal control failure |
  | EVT06 | SIM-MOON | Orthostatic intolerance on arrival at 1/6 g |
  | EVT07 | SIM-RETURN | Re-adaptation to 1 g |
  | EVT08 | SIM-LEO | Rising blood pressure |

- The generator is deterministic (`--seed 42`). `--end` sets the end of the 24-hour window.

### Phase 6. Database
- Normalized schema (third normal form), portable to PostgreSQL and SQLite: `data/schema.sql`.
- Three groups of tables:
  - Medical reference: `risk_domain`, `source`, `metric`, `medical_reference`, `mission`.
  - Synthetic data: `crew_member`, `event`, `measurement`, `daily_measurement`.
  - Real evidence: the `nasa_*` tables.
- `data/scripts/build_db.py` regenerates the reference and synthetic data and writes `data/health_monitor.sqlite`. If the NASA CSV files are not present, it keeps the `nasa_*` tables of the existing database, so the repository alone is enough to rebuild.

### Phase 7. Validation
`data/scripts/inspect_db.py` checks the requirements below and writes an HTML report with charts to `data/db/report.html`.

| ID | Requirement | Result |
|---|---|---|
| R01 | Only temperature, pressure, cardiovascular, SpO₂ and radiation metrics | PASS (14 metrics) |
| R02–R06 | Data present for every metric of each area | PASS |
| R07 | Radiation contexts for LEO, Moon and Mars; spikes detected | PASS |
| R08 | Last 24 h every 5 minutes for every crew member | PASS (16 × 288 points) |
| R09 | Every metric has a reference range with a cited source | PASS |
| R10 | Stored status matches the alert rule for every measurement | PASS (0 discrepancies) |
| R11 | No personal data | PASS |
| R12 | Foreign keys and no duplicates | PASS |
| R13 | Every injected anomaly raises at least one alert | PASS (8/8 events) |
| R14 | Every area has citable real NASA data | PASS |
| R15 | Thresholds verified against their source | PASS (verified on 2026-11-14, see `DATA_SOURCES.md` §4) |

## 4. Limitations

- The time series are synthetic. They show realistic patterns but are not measurements of real people.
- The 30-day and 1-year limits of NASA-STD-3001 are organ doses in mGy-Eq. The database stores dose in mSv, so that comparison is an approximation.
- `SRC_PROJECT` thresholds are design heuristics and should be reviewed with medical advice.
- Topic tagging and evidence linking use keyword rules. Some findings may be misclassified.
- Raw LSDA data files were not downloaded, so the evidence is limited to published results and metadata.

## 5. Reproducibility

```bash
pip install -r data/requirements.txt
python data/scripts/build_db.py          # reference + synthetic data -> data/health_monitor.sqlite
python data/scripts/inspect_db.py        # requirement checks + HTML report
# Optional: refresh the nasa_* tables from the cleaned catalog folder
python data/scripts/normalize_nasa.py --src "<cleaned catalog folder>"
```

## 6. Change log

| Date | Change |
|---|---|
| 2026-11-14 | Catalog cleaned (Phase 1) and enriched through the NLSP portal (Phases 2–3) |
| 2026-11-14 | First database version: 41 metrics covering NASA's 5 spaceflight hazards (radiation, isolation, distance, gravity, environment) |
| 2026-11-14 | Data CSV files removed from version control |
| 2026-11-14 | Scope reduced to temperature, pressure, cardiovascular, SpO₂ and radiation (14 metrics). Reference tables moved to `data/scripts/reference_data.py`. The database file `data/health_monitor.sqlite` is now versioned. Sources and methodology documented |
| 2026-11-14 | All citations and values verified against the original sources. Corrected: ACC/AHA guideline title, NEWS2, NASA-STD-3001 and ISS dose links, cabin temperature limits (18–27 °C). Cabin pressure band relabelled as a project heuristic. R15 now passes |

## 7. Tools

Python 3 (standard library, `sqlite3`), pandas and matplotlib. Data preparation and code were developed with the help of an AI coding assistant (Claude Code). All sources, values and results are listed in this document and in [`DATA_SOURCES.md`](DATA_SOURCES.md) so they can be checked independently.
