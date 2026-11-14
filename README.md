# Health_Monitor_for_Astronauts

Long-duration missions expose astronauts to space radiation,
isolation and confinement, altered gravity, and a hostile closed environment,
which can bring immune changes, bone loss, cardiovascular events,
and behavioral health problems.

Our mission for this problematic is try to prevent problems for the astronauts
before it causes disseases or issues between the tripulation. 

Frontend developed in:

*React
*JavaScript

Backend developed in:

*Python
*FastAPI


┌─────────────────────────────────────────────────┐
│  React (Frontend)                               │
│  ├── @sentry/react          → JS errors         │
│  ├── OTel Web SDK           → Browser tracing   │
│  └── Recharts               → Custom dashboard  │
│         │                                        │
│         ▼  GET /api/metrics/last-24h            │
├─────────────────────────────────────────────────┤
│  FastAPI (Backend)                              │
│  ├── sentry-sdk             → Python errors     │
│  ├── OTel Python SDK        → Distributed tracing│
│  └── INSERT INTO metrics    → Write to provided DB│
├─────────────────────────────────────────────────┤
│  Provided Database (PostgreSQL / MySQL)         │
│  └── Pre-existing schema (metrics, logs, etc.)  │
└─────────────────────────────────────────────────┘   
