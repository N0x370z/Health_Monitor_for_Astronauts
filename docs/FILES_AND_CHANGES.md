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
│   ├── src/services/bone.js      # bone densitometry: bone loss by region vs LSC, ranking, subject timeline
│   ├── src/services/mining.js    # AUC + bootstrap CI, permutation test, LOSO ridge logistic regression, Brier, CUSUM (Erik)
│   ├── src/services/assessment.js# metric status, cardiac score by region, ASE diastolic, alerts, recommendations
│   ├── src/services/analytics.js # data mining: group effects, reliability, correlations, predictors, phenotypes
│   ├── src/routes/subjects.js    # subjects list, subject dashboard, echo table
│   ├── src/routes/bone.js        # /api/bone, /api/bone/subjects, /api/bone/subjects/:code
│   ├── src/routes/study.js       # CFT70 study, effects, countermeasures, /api/analytics/*
│   ├── src/routes/knowledge.js   # alerts, cardiovascular problems, reference ranges
│   ├── test/api.test.js          # 22 endpoint tests (node --test)
│   └── test/stats.test.js        # 8 tests of the statistics module
├── frontend/                     # ORBIT CARE (React + Vite) in layers: src/app, src/ui, src/domain, src/data; api/index.js runs the backend on Vercel; see frontend/README.md
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
    ├── GLOSSARY.md                    # terms and abbreviations shown in the app
    ├── BONE_DENSITY.md                # bone densitometry: import, relevant parameters and structures
    ├── FINAL_REPORT.md                # final technical report (computer-science paper format)
    ├── report/                        # report figures: architecture.png, bone_loss_by_region.png
    └── PROMPTS.md                     # useful prompts for the project
```

## Changes in v5 (2026-11-15): bone densitometry

| Type | Detail |
|---|---|
| Added tables | `bone_campaign` (4), `bone_subject` (74), `bone_region` (11), `bone_parameter` (4), `bone_measurement` (19,727), view `v_bone_visit` |
| Added sources | `LSDA_MR035G`, `SRC_SPECTOR_2009`, `SRC_LANG_2004`, `SRC_KANIS_1994`, `SRC_ISCD_2013`, `SRC_GLUER_1995`, `SRC_BAIM_2005` |
| Added code | `backend/src/services/bone.js`, `backend/src/routes/bone.js`, 2 tests |
| Added docs | `docs/BONE_DENSITY.md`; bone sections in `README.md`, `data/README.md`, `DATA_SOURCES.md`, `DATA_METHODOLOGY.md`, `GLOSSARY.md` |
| Updated | `data/schema.sql` (bone tables), `data/queries.sql` (queries 9 and 10) |
| Not imported | Personal fields, absolute dates, body composition, Ward's triangle, single vertebrae, empty subregion files, screening scans |
| Frontend | Bone density screen (`ui/views/BoneDensity.jsx`, `domain/bone.js`, `data/bone.js`); guided tour per screen in the app palette (`domain/tour.js`, `ui/components/Tour.jsx`); code moved into layers (`app/`, `ui/`, `domain/`, `data/`, `data/api.js`); ORBIT CARE v2.2 merged |
| Early warning | `services/mining.js`, `earlyWarningValidation` and `trajectoryAlarm` in `analytics.js`, `trend` recommendation, route `/api/analytics/early-warning` (Erik, PR #2) |
| Report | `docs/FINAL_REPORT.md` and `docs/report/` figures |
| Fixes | Gap filling also applied to API data (the echo table failed in production); Countermeasures heart-rate chart asked for `metric=undefined` |

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
| Tests | 9 → 28 |

### Frontend
The skeleton was replaced by the team's ORBIT CARE v2 (branch `v2-frontend`, merged keeping its history). It reads the CFT70 echo CSV files bundled in `frontend/src/data/echo/`. Fixes made on integration: analysts coded A1–A3 (the CSV had their names), RVSP with RAP 3 mmHg like the database, README updated to the existing files. The page icon is an original heart-and-orbit design (`public/orbit-care-icon.svg`, rendered to `orbit-care-icon.png`, `orbit-care-touch.png` and `favicon.ico`; new file names so browsers do not keep the cached NASA icon); it replaced an earlier NASA-logo icon, because Space Apps rules do not allow NASA branding. Later: ORBIT CARE v2.1 merged (simulated live pulse/SpO₂ in `src/sim/live.js`, ECG in `src/components/Ecg.jsx`) and a mini tutorial per screen (`src/data/tutorial.js`, `src/components/Tutorial.jsx`). Connection: `src/data/echo.js` loads `/api/study/cft70/echo-data` at start (CSV files as fallback), Countermeasures reads `/api/study/cft70/effects`, and `api/index.js` serves the API on Vercel.

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
