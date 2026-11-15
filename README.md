# Health Monitor for Astronauts

> Cardiovascular health monitoring for astronauts on space missions, built on real NASA data and a shared database.

Away from Earth's gravity the heart changes. Fluids shift to the head, plasma volume falls, the heart pumps less blood per beat and loses muscle mass. On returning to gravity, astronauts may faint when they stand up. NASA's 70-day bed rest study (CFT70) shows it clearly: without exercise, left ventricular mass fell **13.7 %** and stroke volume **14.3 %**, and heart rate rose **51 %** on getting up. With exercise countermeasures, those losses were much smaller.

Our goal is to **detect these problems early and prevent them**. The monitor follows the 37 real CFT70 subjects through their echocardiography sessions (before, during and after 70 days of bed rest). It turns each session into:
- a cardiac score by heart region;
- alerts with a concrete recommended action and countermeasure;
- evidence from the study itself about what protects the heart.

> **Note:** No hardware is used. All data comes from NASA datasets stored in the project database. This is an educational prototype, not a medical device.

## Features

- **Heart monitor (per subject):**
  - cardiac score 0–100 by region (left ventricle, aortic outflow, rate and timing, mitral valve, right ventricle) at any timepoint (Pre, D7, D21, D30, D70, R+0, R+3);
  - key values (ejection fraction, cardiac output, heart rate) and diastolic function by the ASE 2016 criteria;
  - alerts with the recommended action, the current countermeasure and the recommended one;
  - full echocardiography table with % change from baseline and weekly trend.
- **Team:** all subjects ordered by score, with LV mass change, heart rate and response phenotype.
- **Countermeasures:** what 70 days of bed rest did to each group (Control vs exercise), with confidence intervals, tests and effect sizes, plus findings written from the data.
- **Data mining:**
  - reliability of the 3D echo between analysts and the minimum detectable change;
  - early predictors (day 7 → day 70, day 70 → return);
  - correlations between changes;
  - response phenotypes (k-means++).
- **Problems and prevention:** the 7 cardiovascular problems of spaceflight, why they happen, what the data shows and how to prevent them.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript, Recharts, Vite (skeleton; the new design is being developed by the team) |
| Backend | Node.js 22, built-in modules only (`node:http`, `node:sqlite`). No framework, no dependencies |
| Database | SQLite: `data/health_monitor.sqlite` (schema portable to PostgreSQL) |
| Data | NASA CFT70 / BRSMCF echocardiography (real) and NASA LSDA evidence (real). No synthetic data |

## Architecture

The database lives in the same repository (`data/`). The backend reads it directly, in read-only mode, and serves the web app through a JSON API.

```text
┌──────────────────────────────────────────────────────────┐
│ React (Frontend) · Vite · Recharts                       │
│ ├── Heart monitor · Countermeasures · Team               │
│ └── Problems and prevention                              │
│            │                                             │
│            ▼ GET /api/...  (JSON)                        │
├──────────────────────────────────────────────────────────┤
│ Node.js (Backend, no framework)                          │
│ ├── routes: subjects, study, analytics, knowledge        │
│ ├── services/assessment.js → score, alerts, advice       │
│ ├── services/analytics.js  → statistics, data mining     │
│ └── services/stats.js      → t tests, ICC, k-means…      │
├──────────────────────────────────────────────────────────┤
│ SQLite (read-only, same repository)                      │
│ └── data/health_monitor.sqlite                           │
└──────────────────────────────────────────────────────────┘
```

## Data

- **Database:** `data/health_monitor.sqlite` (3.6 MB). Tables are described in [`data/README.md`](data/README.md).
- **Cardiovascular problems tracked:**
  - orthostatic intolerance
  - cardiac atrophy
  - reduced stroke volume
  - tachycardia
  - blood pressure dysregulation
  - diastolic filling changes
  - radiation-induced circulatory disease
- **Real data:**
  - NASA CFT70 / BRSMCF echocardiography: 37 subjects, 7 timepoints, 4 groups, 7,890 measured values plus 863 derived with clinical formulas (cardiac output, Tei index, RV systolic pressure, average E/e′).
  - NASA Life Sciences Data Archive evidence: 829 datasets, 158 experiments, 237 findings.
- **Monitoring, scoring and data mining:** [`docs/CARDIOVASCULAR_MONITORING.md`](docs/CARDIOVASCULAR_MONITORING.md)
- **Sources and citations:** [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)
- **Method and work record:** [`docs/DATA_METHODOLOGY.md`](docs/DATA_METHODOLOGY.md)

### Key findings from the data
- **Exercise protects the heart.** Every protocol lost less LV mass than Control. Exercise B vs Control: Hedges' g 1.21, p = 0.011. The differences between protocols are not significant.
- **A normal cardiac output can hide deconditioning.** Heart rate rises and compensates for the lower stroke volume.
- **LVOT VTI is the strongest single signal** (Doppler 2D, g = 2.18).
- **The end-of-mission echo predicts trouble on return.** A lower E/A, LVOT VTI or LV mass at day 70 predicts a larger heart-rate jump on getting up (r = −0.47 to −0.61).
- **Measurement error matters.** LV mass changes under ~6.5 % cannot be told apart from analyst reading error, so they do not raise alerts.

## Getting Started

### Prerequisites
- Node.js >= 22.13 (includes `node:sqlite`)

### Backend
```bash
cd backend
cp .env.example .env    # optional
npm start               # http://localhost:8000/api/health
npm test                # 27 tests (endpoints, errors and statistics)
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

## API

All endpoints are `GET` and return JSON. Timepoints accept `Pre, D7, D21, D30, D70, R+0, R+3` (or `BR-2`, `BR70`…); the default is `D70`. Subjects accept `6546` or `S6546`.

| Endpoint | Description |
|---|---|
| `/api/health` | Service status |
| `/api/subjects?timepoint=&group=&subset=7` | Subjects ordered by score, with status, LV mass change, heart rate and phenotype |
| `/api/subjects/:code?timepoint=` | Subject dashboard: score by region, key values, diastolic function, alerts, recommendations, countermeasure plan |
| `/api/subjects/:code/echo?metrics=all` | Echocardiography table: every timepoint with value, % change, status and weekly trend |
| `/api/alerts?timepoint=&level=&group=` | Alerts for all subjects, most severe first |
| `/api/study/cft70` | Study, groups, timepoints, key metrics, data quality |
| `/api/study/cft70/effects?metric=&timepoint=` | Change by group and timepoint with 95 % CI, t-test, Hedges' g vs Control |
| `/api/study/cft70/countermeasures?timepoint=` | Countermeasure summary cards and findings |
| `/api/analytics/reliability` | 3D echo agreement between analysts: ICC, SEM, MDC95, Bland-Altman |
| `/api/analytics/correlations?timepoint=` | Correlations between changes (Pearson, Spearman, Benjamini-Hochberg) |
| `/api/analytics/predictors` | Early predictors: D7 → D70 losses, D70 → heart-rate rise at R+0 |
| `/api/analytics/phenotypes?k=2` | Response phenotypes (k-means++) and deconditioning index |
| `/api/problems` · `/api/problems/:code` | Cardiovascular problems with countermeasures, rules and NASA evidence |
| `/api/reference` | Metrics, reference ranges, change thresholds, heart regions, countermeasures, sources |

## Project Structure

```text
├── backend/       # Node.js API (src/routes, src/services, test/)
├── frontend/      # React dashboard (skeleton)
├── data/          # health_monitor.sqlite, schema.sql, queries.sql
├── docs/          # monitoring logic, sources, methodology, files and changes, prompts
└── README.md
```

Full map and change history: [`docs/FILES_AND_CHANGES.md`](docs/FILES_AND_CHANGES.md). Useful prompts: [`docs/PROMPTS.md`](docs/PROMPTS.md).

## Changelog

### v4: real data only and data mining (current)

**Database**
- Removed the synthetic crew (16 crew members, 4 missions, 24 h vital signs and history). The monitor now follows the real CFT70 subjects.
- Removed what did not help the cardiovascular focus or had no real data: hypoxemia, fever, SpO₂, temperature, exercise minutes and radiation spikes. The precomputed `study_effect` table is now computed by the backend.
- Added derived metrics with clinical formulas (cardiac output, Tei index, RV systolic pressure, average E/e′). The formula of every derived value is stored with it.
- Added guideline ranges (ASE 2015, ASE 2016, Rudski 2010) and the heart regions used by the cardiac score.
- Size: 9.4 MB → 3.6 MB.

**Backend**
- Rebuilt around the subjects of the study:
  - cardiac score by region;
  - measurement-error filter;
  - diastolic assessment;
  - alerts and recommendations.
- New data mining: group statistics with confidence intervals and effect sizes, 3D echo reliability, correlations, early predictors and response phenotypes.
- Removed the crew endpoints (`/api/crew`, `/api/missions`, `/api/metrics/last-24h`) and `TIME_SHIFT`.
- 27 tests, including a statistics module checked against reference values.
- Hardening: a malformed URL returns 400 instead of stopping the server; change analyses (countermeasures, correlations, phenotypes) reject the baseline `Pre` with 400.

**Frontend**
- Not modified. Its crew views no longer receive data; the new design uses the subject endpoints.

### v3: cardiovascular focus

**Database**
- Imported the NASA CFT70 / BRSMCF echocardiography files: 37 subjects, 7 timepoints, 4 groups, 7,890 values with quality flags.
- Corrections made during the import:
  - The two "7 Subjects" files were identical, so they were merged.
  - A `0.0` value in the subset was treated as missing.
  - The 3D column `LVSV` was identified as end-systolic volume; stroke volume and ejection fraction were derived from it.
  - Analyst names were replaced by codes.
- Added a cardiovascular knowledge base: problems, alert rules, countermeasures backed by NASA evidence, and change-from-baseline thresholds derived from CFT70.
- Recalibrated the synthetic crew with the CFT70 trajectories (removed in v4).
- Limited the NASA evidence to cardiovascular topics. Removed cabin temperature and pressure.

**Code**
- Removed the Python data scripts (`data/scripts/`, `data/requirements.txt`). The database is now the source of truth.
- **Backend:** Node.js with built-in modules only. It reads the database directly and applies the prevention logic.
- **Frontend:** React + Recharts skeleton.

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

- Connect the new frontend design to the subject endpoints
- Daily check-in storage (requires a write path; the database is read-only today)
- Validation of the score on an independent cohort or spaceflight data
- Medical review of the heuristic thresholds, region weights and score bands
- Authentication and per-role views (crew, flight surgeon)

## License

<MIT / other>
