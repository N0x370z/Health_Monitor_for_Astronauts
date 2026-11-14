# Health Monitor for Astronauts

> Real-time health and wellbeing monitoring dashboard for long-duration space missions.

Long-duration missions expose astronauts to space radiation, isolation and confinement, altered gravity, and a hostile closed environment. These conditions can lead to immune changes, bone loss, cardiovascular events, and behavioral health problems.

Our mission is to detect and prevent these problems early, before they develop into diseases or cause conflicts among the crew.

## Features

- <Metric 1, e.g. heart rate / SpO₂ / temperature>
- <Metric 2>
- Dashboard with the last 24 hours of data
- Error and performance monitoring (Sentry + OpenTelemetry)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript, Recharts |
| Backend | Python, FastAPI |
| Database | PostgreSQL / MySQL |
| Observability | Sentry, OpenTelemetry |

## Architecture

```text
┌─────────────────────────────────────────────────┐
│ React (Frontend)                                │
│ ├── @sentry/react → JS errors                   │
│ ├── OTel Web SDK  → Browser tracing             │
│ └── Recharts      → Custom dashboard            │
│            │                                    │
│            ▼ GET /api/metrics/last-24h          │
├─────────────────────────────────────────────────┤
│ FastAPI (Backend)                               │
│ ├── sentry-sdk       → Python errors            │
│ ├── OTel Python SDK  → Distributed tracing      │
│ └── INSERT INTO metrics → Write to the DB       │
├─────────────────────────────────────────────────┤
│ Database (PostgreSQL / MySQL)                   │
│ └── Pre-existing schema (metrics, logs, etc.)   │
└─────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites
- Node.js >= <version>
- Python >= 3.<x>
- PostgreSQL or MySQL

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
| `SENTRY_DSN` | Sentry project DSN |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector endpoint |

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/metrics/last-24h` | Returns metrics from the last 24 hours |
| POST | `/api/metrics` | <Stores a new metric> |

## Project Structure

```text
├── backend/
├── frontend/
└── README.md
```

## Disclaimer

This is an educational prototype and is not a certified medical device.

## License

<MIT / other>

