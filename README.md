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
| Data | <Dataset name(s) and source> |
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

- **Source:** <dataset name, link>
- **Metrics used:** <list>
- **Processing:** <cleaning, how timestamps are mapped to "last 24h">

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
└── README.md
```

## Future Work

- Alerts for abnormal values
- Longer history and filters per astronaut
- Authentication

## License

<MIT / other>
