# Health Monitor for Astronauts

> Dashboard for monitoring the health and wellbeing of astronauts on long-duration space missions, built on top of datasets and a shared database.

Long-duration missions expose astronauts to space radiation, isolation and confinement, altered gravity, and a hostile closed environment. These conditions can lead to immune changes, bone loss, cardiovascular events, and behavioral health problems.

Our goal is to detect and prevent these problems early, before they develop into diseases or cause conflicts among the crew.

> **Note:** No hardware is used. All data comes from datasets and a pre-existing database. This is an educational prototype, not a medical device.

## Features

- Dashboard with the last 24 hours of health metrics
- Charts per metric: <heart rate, temperature, SpO₂, ...>
- <Highlighted anomalies / abnormal values>
- Optional error tracking with Sentry

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript, Recharts |
| Backend | Python, FastAPI |
| Database | SQLite (`data/health_monitor.sqlite`), schema portable to PostgreSQL |
| Data | Synthetic data calibrated with clinical guidelines and NASA LSDA evidence (`data/`, `docs/DATA_SOURCES.md`) |
| Error tracking | Sentry (optional) |

## Architecture

```text
┌─────────────────────────────────────────────────┐
│ React (Frontend)                                │
│ ├── Recharts      → Dashboard                   │
│ └── @sentry/react → JS errors (optional)        │
│            │                                    │
│            ▼ GET /api/metrics/last-24h          │
├─────────────────────────────────────────────────┤
│ FastAPI (Backend)                               │
│ ├── Reads metrics from the database             │
│ └── sentry-sdk → Python errors (optional)       │
├─────────────────────────────────────────────────┤
│ Database (SQLite / PostgreSQL)                  │
│ └── data/health_monitor.sqlite                  │
└─────────────────────────────────────────────────┘
```

## Data

- **Database:** `data/health_monitor.sqlite` (SQLite, versioned in the repo; the schema in `data/schema.sql` also runs on PostgreSQL). Details in [`data/README.md`](data/README.md).
- **Metrics used:** 14 metrics in five areas:
  - temperature: body and cabin
  - pressure: cabin, systolic and diastolic blood pressure
  - cardiovascular: heart rate, palpitations, orthostatic response after a change of gravity
  - oxygen saturation: SpO₂
  - radiation: dose rate, spikes, 30-day, 1-year and career dose
- **Source:** synthetic, anonymous crew and cabin data, calibrated with cited clinical guidelines and space radiation studies. Real, public evidence from the [NASA Life Sciences Data Archive](https://nlsp.nasa.gov/explore/data) (737 datasets, 207 experiments, 268 published findings). No personal data.
- **Processing:** every measurement gets a `normal` / `warning` / `critical` status from the medical reference table. The last 24 h are sampled every 5 min; mission history is daily. Injected anomalies are labelled so alert logic can be evaluated.
- **Sources and citations:** [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md). **Method and work record:** [`docs/DATA_METHODOLOGY.md`](docs/DATA_METHODOLOGY.md).

## Getting Started

### Prerequisites
- Node.js >= <version>
- Python >= 3.<x>
- Access to the database

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Database connection string |
| `SENTRY_DSN` | Sentry DSN (optional) |

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/metrics/last-24h` | Returns metrics from the last 24 hours |

## Project Structure

```text
├── backend/
├── frontend/
├── data/          # database (health_monitor.sqlite), schema, scripts
├── docs/          # data sources, citations and methodology
└── README.md
```

## Future Work

- Alerts for abnormal values
- Longer history and filters per astronaut
- Authentication

## License

<MIT / other>
