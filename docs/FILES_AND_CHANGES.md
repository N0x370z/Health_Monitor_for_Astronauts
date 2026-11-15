# Files and Changes

Map of the repository and what changed in each version (v4 2026-11-15, v3 2026-11-14).

## Repository map

```text
├── README.md                     # project overview, setup, API, changelog
├── backend/                      # API (Node.js, no framework, no dependencies)
│   ├── package.json              # npm start / dev / test
│   ├── .env.example              # PORT, DB_PATH, CORS_ORIGIN
│   ├── src/server.js             # HTTP server and route table
│   ├── src/config.js             # settings (reads backend/.env)
│   ├── src/db.js                 # read-only connection to data/health_monitor.sqlite (node:sqlite)
│   ├── src/http.js               # JSON responses, CORS, minimal router
│   ├── src/services/dataset.js   # loads CFT70 and the knowledge base into memory once
│   ├── src/services/stats.js     # statistics: t tests, CI, Hedges' g, correlation, ICC/MDC, BH, k-means++
│   ├── src/services/assessment.js# metric status, cardiac score by region, ASE diastolic, alerts, recommendations
│   ├── src/services/analytics.js # data mining: group effects, reliability, correlations, predictors, phenotypes
│   ├── src/routes/subjects.js    # subjects list, subject dashboard, echo table
│   ├── src/routes/study.js       # CFT70 study, effects, countermeasures, /api/analytics/*
│   ├── src/routes/knowledge.js   # alerts, cardiovascular problems, reference ranges
│   ├── test/api.test.js          # 19 endpoint tests (node --test)
│   └── test/stats.test.js        # 8 tests of the statistics module
├── frontend/                     # skeleton dashboard (React + Recharts + Vite), not updated in v4
├── data/
│   ├── health_monitor.sqlite     # ★ the database (versioned)
│   ├── schema.sql                # schema and views
│   ├── queries.sql               # example queries
│   └── README.md                 # tables and usage
└── docs/
    ├── CARDIOVASCULAR_MONITORING.md   # problems, evidence, scoring, data mining, validation
    ├── DATA_SOURCES.md                # sources, citations, declarations
    ├── DATA_METHODOLOGY.md            # method, validation, change log
    ├── FILES_AND_CHANGES.md           # this file
    └── PROMPTS.md                     # useful prompts for the project
```

## Changes in v4 (2026-11-15): real data only and data mining

### Database
| Change | Detail |
|---|---|
| Removed | Synthetic crew: `mission`, `crew_member`, `measurement`, `daily_measurement`, `event`, view `v_latest_vitals` |
| Removed | `study_effect` (the backend computes it with CI and tests) |
| Removed | Problems `HYPOXEMIA`, `FEVER_INFECTION`; metrics `spo2`, `body_temp`, `exercise_minutes`, `dose_rate_spike_ratio`, `resting_heart_rate`, with their rules, ranges, findings and unused sources |
| Changed | Resting heart-rate threshold, range and rules now use `hr_tdi_left` (measured in CFT70) |
| Added | Derived metrics `cardiac_output`, `tei_index`, `rvsp`, `e_e_prime_avg` (863 values) |
| Added | `cardiac_region`, `region_metric`; `study_timepoint.short_label` |
| Added | Ranges REF027–REF029, Tei change threshold, rules AR31–AR33, 5 verified sources |
| Size | 9.4 MB → 3.6 MB |

### Backend
| Change | Detail |
|---|---|
| Removed | `routes/crew.js`, `services/alerts.js`, `services/time.js`; endpoints `/api/missions`, `/api/crew*`, `/api/metrics/last-24h`; `TIME_SHIFT` |
| Added | `services/dataset.js`, `services/stats.js`, `services/assessment.js`, `services/analytics.js`, `routes/subjects.js` |
| Added | `/api/subjects`, `/api/subjects/:code`, `/api/subjects/:code/echo`, `/api/study/cft70/countermeasures`, `/api/analytics/reliability`, `/correlations`, `/predictors`, `/phenotypes` |
| Changed | `/api/alerts` (by timepoint and group), `/api/study/cft70/effects` (CI, tests, effect size), `/api/reference` (regions) |
| Tests | 9 → 25 |

### Frontend
Not modified. The skeleton views that used `/api/crew` and `/api/missions` no longer receive data; the new design developed by the team uses the subject endpoints.

## Changes in v3

### Database (`data/health_monitor.sqlite`, `data/schema.sql`)
| Change | Detail |
|---|---|
| Added | `cv_problem`, `change_threshold`, `countermeasure`, `problem_countermeasure`, `alert_rule` |
| Added | `study`, `study_group`, `study_subject`, `study_timepoint`, `study_echo_measurement`, `study_effect` with the 4 CFT70 files |
| Added | Views `v_study_3d_mean`, `v_problem_evidence`, `v_latest_vitals` |
| Changed | `metric` (49 cardiovascular metrics, with category, problem, derived flag, unit note) |
| Changed | `medical_reference` (26 ranges, plus ASE echo ranges and circulatory radiation limits) |
| Changed | Synthetic crew recalibrated with CFT70; echocardiography sessions added; 8 events, each linked to a problem |
| Changed | NASA evidence limited to cardiovascular topics; findings linked to problems |
| Removed | `risk_domain`, `nasa_topic`, `nasa_dataset_topic`, `nasa_dataset_mission`, `nasa_dataset_metric_link`; cabin temperature and pressure |

### Removed files
- `data/scripts/reference_data.py`, `generate_synthetic.py`, `normalize_nasa.py`, `build_db.py`, `inspect_db.py`
- `data/requirements.txt`

Reason: the data is no longer shown through scripts. The backend and the frontend read the database directly.

### New code
- `backend/`: API with built-in Node.js modules (`node:http`, `node:sqlite`), with no framework and no external dependencies.
- `frontend/`: dashboard with three views (crew monitoring, problems and prevention, CFT70 evidence).

### Updated documentation
- `README.md`: tech stack, architecture, setup, API.
- `docs/DATA_SOURCES.md`, `docs/DATA_METHODOLOGY.md`, `data/README.md`.
- New: `docs/CARDIOVASCULAR_MONITORING.md`, `docs/FILES_AND_CHANGES.md`, `docs/PROMPTS.md`.
