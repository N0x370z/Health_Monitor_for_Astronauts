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
| Database | <PostgreSQL / MySQL> |
| Data | Synthetic data calibrated with NASA LSDA results and clinical guidelines (`data/`) |
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
│ Database (<PostgreSQL / MySQL>)                 │
│ └── Metrics table loaded from datasets          │
└─────────────────────────────────────────────────┘
```

## Data

- **Source:** synthetic crew data calibrated with clinical guidelines and real, public results from the [NASA Life Sciences Data Archive](https://nlsp.nasa.gov) (no personal data). Details in [`data/README.md`](data/README.md).
- **Metrics used:** 41 metrics across NASA's 5 spaceflight hazards: radiation (dose rate, spikes, cumulative dose), isolation and stress (sleep, reaction time, PHQ-9/GAD-7, PSS-10, cortisol, HRV), distance from Earth (communication delay, body mass), gravity (heart rate, blood pressure, bone, muscle strength and volume, urinary calcium, motion sickness, balance) and closed environment (SpO₂, body temperature, cabin CO₂/O₂/temperature/pressure/NH₃, light, noise).
- **Processing:** the core table `data/reference/medical_reference.csv` defines normal and critical ranges per metric and mission context. `data/scripts/generate_synthetic.py` creates the last 24 h (every 5 min) ending at `--end` (use the current UTC time) plus the mission history, and labels injected anomalies. The schema is in `data/schema.sql` (PostgreSQL / SQLite).

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
├── data/          # database: medical reference, synthetic data, NASA evidence, schema
└── README.md
```

## Future Work

- Alerts for abnormal values
- Longer history and filters per astronaut
- Authentication

## License

<MIT / other>
