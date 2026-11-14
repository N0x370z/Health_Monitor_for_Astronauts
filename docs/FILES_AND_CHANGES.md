# Files and Changes

Map of the repository and what changed in the cardiovascular version (v3, 2026-11-14).

## Repository map

```text
├── README.md                     # project overview, setup, API
├── backend/                      # API (Node.js, no framework, no dependencies)
│   ├── package.json              # npm start / dev / test
│   ├── .env.example              # PORT, DB_PATH, CORS_ORIGIN, TIME_SHIFT
│   ├── src/server.js             # HTTP server and route table
│   ├── src/config.js             # settings (reads backend/.env)
│   ├── src/db.js                 # read-only connection to data/health_monitor.sqlite (node:sqlite)
│   ├── src/http.js               # JSON responses, CORS, minimal router
│   ├── src/services/alerts.js    # prevention logic: alerts, risk index, 24 h episodes
│   ├── src/services/time.js      # shifts demo timestamps so the last 24 h end now
│   ├── src/routes/crew.js        # missions, crew, vitals, history, /api/metrics/last-24h
│   ├── src/routes/knowledge.js   # alerts, cardiovascular problems, reference ranges
│   ├── src/routes/study.js       # CFT70 study and effects by group
│   └── test/api.test.js          # 9 endpoint tests (node --test)
├── frontend/                     # dashboard (React + Recharts + Vite)
│   ├── package.json, vite.config.js, index.html
│   └── src/
│       ├── App.jsx               # navigation: Crew · Problems & prevention · CFT70 evidence
│       ├── api.js                # fetch helper and useApi hook (auto refresh)
│       ├── format.js             # labels and number formats
│       ├── styles.css            # light/dark theme, layout
│       ├── components/ui.jsx     # badges, cards, alert list
│       ├── components/charts.jsx # vital signs, blood pressure, echo vs CFT70, daily, study charts
│       └── views/                # CrewOverview, CrewDetail, ProblemsView, StudyView
├── data/
│   ├── health_monitor.sqlite     # ★ the database (versioned)
│   ├── schema.sql                # schema and views
│   ├── queries.sql               # example queries
│   └── README.md                 # tables and usage
└── docs/
    ├── CARDIOVASCULAR_MONITORING.md   # problems, evidence, prevention logic
    ├── DATA_SOURCES.md                # sources, citations, declarations
    ├── DATA_METHODOLOGY.md            # method, validation, change log
    ├── FILES_AND_CHANGES.md           # this file
    └── PROMPTS.md                     # useful prompts for the project
```

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
- `backend/`: API with built-in Node.js modules (`node:http`, `node:sqlite`). No FastAPI and no external dependencies.
- `frontend/`: dashboard with three views (crew monitoring, problems and prevention, CFT70 evidence).

### Updated documentation
- `README.md`: tech stack, architecture, setup, API.
- `docs/DATA_SOURCES.md`, `docs/DATA_METHODOLOGY.md`, `data/README.md`.
- New: `docs/CARDIOVASCULAR_MONITORING.md`, `docs/FILES_AND_CHANGES.md`, `docs/PROMPTS.md`.
