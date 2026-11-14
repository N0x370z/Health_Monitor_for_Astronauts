# Health Monitor for Astronauts

> Cardiovascular health monitoring for astronauts on space missions, built on real NASA data and a shared database.

Away from Earth's gravity the heart changes. Fluids shift to the head, plasma volume falls, the heart pumps less blood per beat and loses muscle mass. On returning to gravity, astronauts may faint when they stand up. NASA's 70-day bed rest study (CFT70) shows it clearly: without exercise, left ventricular mass fell **13.7 %** and stroke volume **14.3 %**, and heart rate rose **51 %** on getting up. With exercise countermeasures, those losses were much smaller.

Our goal is to **detect these problems early and prevent them**. The monitor combines:
- continuous vital signs;
- periodic echocardiography;
- orthostatic tests;
- radiation dose.

It turns them into alerts with a concrete recommended action.

> **Note:** No hardware is used. All data comes from datasets and the project database. This is an educational prototype, not a medical device.

## Features

- **Crew overview:** every crew member ordered by risk, with heart rate, blood pressure, SpO₂ and temperature, plus the active alerts across all missions.
- **Crew detail:**
  - vital signs for the last 24 h with reference ranges;
  - alerts with the recommended action and countermeasure;
  - episodes of the last 24 h;
  - echocardiography trend compared with the NASA CFT70 groups;
  - resting heart rate, orthostatic tests, exercise adherence and radiation against NASA limits.
- **Problems and prevention:** the 9 cardiovascular problems of spaceflight, why they happen, what the data shows and how to prevent them.
- **CFT70 evidence:** 70-day bed rest results by group (Control vs exercise) for each echocardiography metric.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript, Recharts, Vite |
| Backend | Node.js 22, built-in modules only (`node:http`, `node:sqlite`). No framework, no dependencies |
| Database | SQLite: `data/health_monitor.sqlite` (schema portable to PostgreSQL) |
| Data | NASA CFT70 / BRSMCF echocardiography (real), NASA LSDA evidence (real), anonymous crew monitoring (synthetic, calibrated) |

## Architecture

```text
┌─────────────────────────────────────────────────┐
│ React (Frontend) · Vite · Recharts              │
│ ├── Crew overview and detail                    │
│ ├── Problems and prevention                     │
│ └── CFT70 evidence                              │
│            │                                    │
│            ▼ GET /api/...  (JSON)               │
├─────────────────────────────────────────────────┤
│ Node.js (Backend, no framework)                 │
│ ├── routes: crew, alerts, problems, study       │
│ └── services/alerts.js → alerts, risk, episodes │
├─────────────────────────────────────────────────┤
│ SQLite (read-only)                              │
│ └── data/health_monitor.sqlite                  │
└─────────────────────────────────────────────────┘
```

## Data

- **Database:** `data/health_monitor.sqlite`. Tables are described in [`data/README.md`](data/README.md).
- **Cardiovascular problems tracked:**
  - orthostatic intolerance
  - cardiac atrophy
  - reduced stroke volume
  - tachycardia and palpitations
  - blood pressure dysregulation
  - diastolic filling changes
  - hypoxemia
  - fever
  - radiation-induced circulatory disease
- **Real data:**
  - NASA CFT70 / BRSMCF echocardiography: 37 subjects, 7 timepoints, 4 groups, 7,890 values.
  - NASA Life Sciences Data Archive evidence: 829 datasets, 158 experiments, 241 findings.
- **Synthetic data:** 16 anonymous crew members on 4 missions (low Earth orbit, Moon, Mars transit, return to Earth). Their trajectories are calibrated with CFT70, and 8 labelled events test the alerts.
- **Monitoring and prevention logic:** [`docs/CARDIOVASCULAR_MONITORING.md`](docs/CARDIOVASCULAR_MONITORING.md)
- **Sources and citations:** [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)
- **Method and work record:** [`docs/DATA_METHODOLOGY.md`](docs/DATA_METHODOLOGY.md)

## Getting Started

### Prerequisites
- Node.js >= 22.13 (includes `node:sqlite`)

### Backend
```bash
cd backend
cp .env.example .env    # optional
npm start               # http://localhost:8000/api/health
npm test                # 9 endpoint tests
```

### Frontend
```bash
cd frontend
npm install
npm run dev             # http://localhost:5173 (proxies /api to the backend)
```

## Environment Variables (backend)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | HTTP port |
| `DB_PATH` | `../data/health_monitor.sqlite` | Path to the database |
| `CORS_ORIGIN` | `*` | Allowed origin |
| `TIME_SHIFT` | `true` | Shift demo timestamps so the last 24 h end at request time |

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service status |
| GET | `/api/metrics/last-24h?crew=&mission=&metric=` | Metrics from the last 24 hours (long format) |
| GET | `/api/missions` | Missions |
| GET | `/api/crew?mission=` | Crew with risk level, score and latest vital signs |
| GET | `/api/crew/:code` | Crew detail: risk, active alerts with action, 24 h episodes, echocardiography |
| GET | `/api/crew/:code/vitals?hours=&metric=` | Vital-sign time series (5 min) |
| GET | `/api/crew/:code/history?metric=` | Daily history (resting HR, BP, exercise, orthostatic, echo, dose) |
| GET | `/api/alerts?level=&mission=` | Active alerts for all crew, most severe first |
| GET | `/api/problems` · `/api/problems/:code` | Cardiovascular problems with countermeasures, rules and evidence |
| GET | `/api/reference` | Metrics, reference ranges, change thresholds, countermeasures, sources |
| GET | `/api/study/cft70` · `/api/study/cft70/effects?metric=` | CFT70 study and change by group and timepoint |

## Project Structure

```text
├── backend/       # Node.js API (src/, test/)
├── frontend/      # React dashboard (src/views, src/components)
├── data/          # health_monitor.sqlite, schema.sql, queries.sql
├── docs/          # monitoring logic, sources, methodology, files and changes, prompts
└── README.md
```

Full map and change history: [`docs/FILES_AND_CHANGES.md`](docs/FILES_AND_CHANGES.md). Useful prompts: [`docs/PROMPTS.md`](docs/PROMPTS.md).

## Changelog

### v3: cardiovascular focus (current)

**Database**
- Imported the NASA CFT70 / BRSMCF echocardiography files: 37 subjects, 7 timepoints, 4 groups, 7,890 values with quality flags.
- Corrections made during the import:
  - The two "7 Subjects" files were identical, so they were merged.
  - A `0.0` value in the subset was treated as missing.
  - The 3D column `LVSV` was identified as end-systolic volume; stroke volume and ejection fraction were derived from it.
  - Analyst names were replaced by codes.
- Added a cardiovascular knowledge base: 9 problems, 30 alert rules, 8 countermeasures backed by NASA evidence, and change-from-baseline thresholds derived from CFT70.
- Recalibrated the synthetic crew with the CFT70 trajectories and added periodic echocardiography sessions and 8 labelled events.
- Limited the NASA evidence to cardiovascular topics. Removed cabin temperature and pressure.

**Code**
- Removed the Python data scripts (`data/scripts/`, `data/requirements.txt`). The database is now the source of truth.
- **Backend:** Node.js with built-in modules only, no FastAPI. It reads the database directly, applies the prevention logic (alerts, risk index, 24 h episodes) and includes 9 tests.
- **Frontend:** React + Recharts. Views: crew overview, crew detail, problems and prevention, CFT70 evidence.

**Docs**
- New: [`CARDIOVASCULAR_MONITORING.md`](docs/CARDIOVASCULAR_MONITORING.md), [`FILES_AND_CHANGES.md`](docs/FILES_AND_CHANGES.md), [`PROMPTS.md`](docs/PROMPTS.md).
- Updated: sources (4 new DOIs verified), methodology and the data README.

### v2: verified scope
- Scope reduced to temperature, pressure, cardiovascular, SpO₂ and radiation.
- The database file became versioned and the data CSV files were removed from version control.
- Every citation and value was verified against its original source. This corrected the cabin temperature limits and several links.

### v1: first database
- Cleaned the NASA LSDA catalog (2,593 → 2,390 health datasets) and enriched it through the NASA Life Sciences Portal.
- First database with 41 metrics across NASA's 5 spaceflight hazards, plus synthetic crew data.

Full details: [`docs/FILES_AND_CHANGES.md`](docs/FILES_AND_CHANGES.md) and [`docs/DATA_METHODOLOGY.md`](docs/DATA_METHODOLOGY.md).

## Future Work

- Error tracking with Sentry
- Authentication and per-role views (crew, flight surgeon)
- Live data ingestion from wearable devices
- Medical review of the heuristic thresholds

## License

<MIT / other>
