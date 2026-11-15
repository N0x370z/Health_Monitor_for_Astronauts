# Health Monitor for Astronauts

> Cardiovascular health monitoring for astronauts on space missions, built on real NASA data and a shared database.

Away from Earth's gravity the heart changes. Fluids shift to the head, plasma volume falls, the heart pumps less blood per beat and loses muscle mass. On returning to gravity, astronauts may faint when they stand up. NASA's 70-day bed rest study (CFT70) shows it clearly: without exercise, left ventricular mass fell **13.7 %** and stroke volume **14.3 %**, and heart rate rose **51 %** on getting up. With exercise countermeasures, those losses were much smaller.

Our goal is to **detect these problems early and prevent them**. The monitor follows the 37 real CFT70 subjects through their echocardiography sessions (before, during and after 70 days of bed rest). It turns each session into:
- a cardiac score by heart region;
- alerts with a concrete recommended action and countermeasure;
- evidence from the study itself about what protects the heart.

> **Note:** No hardware is used. All data comes from NASA datasets stored in the project database. This is an educational prototype, not a medical device.

## Features

The ORBIT CARE web app shows the heart monitor, countermeasures (with the backend statistics) and the daily check-in, each with a short tutorial (**How it works**). Pulse and SpO₂ marked LIVE SIM are simulated; everything else is real study data. Everything below is available through the API; the screens not yet in the web app (team, data mining, problems) can be added from the same endpoints.

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
- **Bone density (API):** DXA of 74 bed-rest subjects (NASA MR035G). Bone loss by skeletal region against the scanner's least significant change, ranking of the most affected structures, and each subject's timeline.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | ORBIT CARE: React 19, Vite. Loads the data from the API; falls back to the bundled CFT70 echo CSV files if the API is down |
| Backend | Node.js 22, built-in modules only (`node:http`, `node:sqlite`). No framework, no dependencies. On Vercel it runs as a function (`frontend/api/index.js`) |
| Database | SQLite: `data/health_monitor.sqlite` (schema portable to PostgreSQL) |
| Data | NASA CFT70 / BRSMCF echocardiography (real) and NASA LSDA evidence (real). No synthetic data |

## Architecture

The database lives in the same repository (`data/`). The backend reads it directly, in read-only mode, and serves a JSON API with the statistics and data mining. The ORBIT CARE frontend loads all the echo values from the API when it starts (`/api/study/cft70/echo-data`) and shows the backend statistics in Countermeasures. If the API does not answer within 5 s it uses the same CFT70 data bundled as CSV files, so the page always works. The header says which source is in use.

```text
┌──────────────────────────────────────────────────────────┐
│ ORBIT CARE (Frontend) · React · Vite                     │
│ ├── Heart monitor · Countermeasures · Daily check-in     │
│ └── fallback: CFT70 echo CSV bundled (offline)           │
│            │                                             │
│            ▼ GET /api/...  (JSON, same domain)           │
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

- **Database:** `data/health_monitor.sqlite` (6.6 MB). Tables are described in [`data/README.md`](data/README.md).
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
  - NASA MR035G bone densitometry (DXA): 74 bed-rest subjects (UTMB Campaign 3 and 1, AG pilot, MEDES), 11 skeletal regions, 19,727 measurements. Details: [`docs/BONE_DENSITY.md`](docs/BONE_DENSITY.md).
- **Monitoring, scoring and data mining:** [`docs/CARDIOVASCULAR_MONITORING.md`](docs/CARDIOVASCULAR_MONITORING.md)
- **Sources and citations:** [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)
- **Method and work record:** [`docs/DATA_METHODOLOGY.md`](docs/DATA_METHODOLOGY.md)
- **Glossary (terms and abbreviations used in the app):** [`docs/GLOSSARY.md`](docs/GLOSSARY.md)
- **Bone density data and analysis:** [`docs/BONE_DENSITY.md`](docs/BONE_DENSITY.md)

### Key findings from the data
- **Exercise protects the heart.** Every protocol lost less LV mass than Control. Exercise B vs Control: Hedges' g 1.21, p = 0.011. The differences between protocols are not significant.
- **A normal cardiac output can hide deconditioning.** Heart rate rises and compensates for the lower stroke volume.
- **LVOT VTI is the strongest single signal** (Doppler 2D, g = 2.18).
- **The end-of-mission echo predicts trouble on return.** A lower E/A, LVOT VTI or LV mass at day 70 predicts a larger heart-rate jump on getting up (r = −0.47 to −0.61).
- **Measurement error matters.** LV mass changes under ~6.5 % cannot be told apart from analyst reading error, so they do not raise alerts.
- **Bone is lost where it carries weight.** After about 60 days of bed rest: total hip −2.8 %, intertrochanteric −3.0 %, trochanter −2.6 %, pelvis −2.1 %, heel −1.8 % (all p < 0.05). The forearm and arms do not change. The total hip is the most reliable structure to follow: 63 % of subjects lost more than the scanner's least significant change (2.3 %).

## Getting Started

### Prerequisites
- Node.js >= 22.13 (includes `node:sqlite`). Check with `node -v`.

### Run everything locally (two terminals)
```bash
# Terminal 1: API on http://localhost:8000
cd backend
npm start

# Terminal 2: web app on http://localhost:5173
cd frontend
npm install        # first time only
npm run dev
```
Open http://localhost:5173. The header must say **"Live from the CFT70 database (API)"**; if it says **"Offline"**, the backend is not running and the app is using the bundled CSV files. Stop each one with `Ctrl+C`.

Production-like check of the web app: `cd frontend && npm run build && npx vite preview` (http://localhost:4173, it does not proxy `/api`, so it runs in offline mode).

### Backend
```bash
cd backend
cp .env.example .env    # optional
npm start               # http://localhost:8000/api/health
npm test                # 30 tests (endpoints, errors and statistics)
```

### Frontend
```bash
cd frontend
npm install
npm run dev             # http://localhost:5173 (proxies /api to the backend on :8000)
npm run build           # dist/
```

### Deploy on Vercel
- Project settings: **Root Directory** `frontend`, framework **Vite**, and keep "Include files outside the root directory" enabled (the function reads `backend/` and `data/`). Node 22 is pinned in `frontend/package.json`.
- `frontend/api/index.js` serves the whole API on the same domain (`/api/...`; `frontend/vercel.json` routes every `/api/*` path to it), reading `data/health_monitor.sqlite` in read-only mode.
- To use an API hosted elsewhere, set `VITE_API_URL` in Vercel (for example `https://my-api.example.com`).

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
| `/api/study/cft70/echo-data` | Every echo value by subject and timepoint (what the frontend loads at start) |
| `/api/study/cft70/effects?metric=&timepoint=` | Change by group and timepoint with 95 % CI, t-test, Hedges' g vs Control |
| `/api/study/cft70/countermeasures?timepoint=` | Countermeasure summary cards and findings |
| `/api/analytics/reliability` | 3D echo agreement between analysts: ICC, SEM, MDC95, Bland-Altman |
| `/api/analytics/correlations?timepoint=` | Correlations between changes (Pearson, Spearman, Benjamini-Hochberg) |
| `/api/analytics/predictors` | Early predictors: D7 → D70 losses, D70 → heart-rate rise at R+0 |
| `/api/analytics/phenotypes?k=2` | Response phenotypes (k-means++) and deconditioning index |
| `/api/bone` | Bone density: campaigns, parameters, regions with bone loss (CI, p, standardized response, % beyond the LSC) and the ranking of the most affected regions |
| `/api/bone/subjects?campaign=` · `/api/bone/subjects/:code` | Bone subjects; one subject's DXA timeline by region with % change from PRE and status (loss / stable / gain) |
| `/api/problems` · `/api/problems/:code` | Cardiovascular problems with countermeasures, rules and NASA evidence |
| `/api/reference` | Metrics, reference ranges, change thresholds, heart regions, countermeasures, sources |

## Project Structure

```text
├── backend/       # Node.js API (src/routes, src/services, test/)
├── frontend/      # ORBIT CARE (React + Vite) + Vercel API function (api/)
├── data/          # health_monitor.sqlite, schema.sql, queries.sql
├── docs/          # monitoring logic, sources, methodology, files and changes, prompts
└── README.md
```

Full map and change history: [`docs/FILES_AND_CHANGES.md`](docs/FILES_AND_CHANGES.md). Useful prompts: [`docs/PROMPTS.md`](docs/PROMPTS.md).

## Changelog

### v5: bone density
- Ordered the NASA MR035G DXA files (1,064 files, 4 bed rest campaigns) into one set of tables in the project database: `bone_campaign`, `bone_subject`, `bone_region`, `bone_parameter`, `bone_measurement` and the view `v_bone_visit`.
- Kept only what is needed to assess bone loss (BMD, BMC, T-score, Z-score at 11 regions). Removed personal fields, absolute dates, body composition and duplicated scans (38,493 → 19,727 rows).
- Extracted the most relevant parameters and structures: the precision and least significant change of every region come from the repeated scans, and the regions are ranked by the bone loss measured in the data. Key regions: total hip, intertrochanteric region, trochanter, pelvis, heel and femoral neck. Controls: forearm and arms.
- New endpoints `/api/bone…`, 2 tests (30 in total), 7 verified sources and [`docs/BONE_DENSITY.md`](docs/BONE_DENSITY.md).

### v4: real data only and data mining

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
- 28 tests, including a statistics module checked against reference values.
- Hardening: a malformed URL returns 400 instead of stopping the server; change analyses (countermeasures, correlations, phenotypes) reject the baseline `Pre` with 400.

**Frontend**
- Replaced the skeleton with the team's ORBIT CARE v2 design (branch `v2-frontend`, history kept): heart monitor, countermeasures and daily check-in, offline with the CFT70 echo CSV files.
- Fixes: 3D echo analysts coded A1–A3 as in the database; RVSP uses RAP 3 mmHg like the database (it used 5); NASA logo as the page icon.
- ORBIT CARE v2.1 merged (simulated live pulse and SpO₂, ECG in Rate & timing) and a mini tutorial for each screen.
- Connected to the backend: the data comes from the database through the API (bundled CSV files as fallback) and Countermeasures shows the Welch t-test and Hedges' g vs Control. The API also runs on Vercel as a function.

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

- Show more of the API in ORBIT CARE (score by region, predictors, phenotypes)
- Daily check-in storage (requires a write path; the database is read-only today)
- Validation of the score on an independent cohort or spaceflight data
- Medical review of the heuristic thresholds, region weights and score bands
- Authentication and per-role views (crew, flight surgeon)

## License

<MIT / other>
