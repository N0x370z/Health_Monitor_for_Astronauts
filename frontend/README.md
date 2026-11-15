# ORBIT CARE — Astronaut Health Monitor (frontend)

NASA Space Apps 2026 · "Create Health Monitoring Software for Astronauts on Space Missions".
Design: Dark/Tech + Glass/Modern, Roboto font bundled locally.

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/ (this is what Vercel deploys)
npm run lint
```
Data comes from the project database through the backend API (`/api/study/cft70/echo-data`). If the API does not answer within 5 s, the app uses the bundled CSV files, so it also works offline. The header shows the source in use. Fonts are bundled locally; check-ins are stored in the browser (`localStorage`).

Local development: run the backend first (`cd ../backend && npm start`); Vite proxies `/api` to `http://localhost:8000`. On Vercel, `api/[...path].js` serves the same API on the same domain. `VITE_API_URL` points the app to an API on another domain.

## Data (offline fallback)
NASA **BRSMCF CFT70** study: 70 days of head-down tilt bed rest (microgravity analog), 37 subjects, 4 groups (Control, Exercise A, Exercise B, Flywheel). The CSV files in `src/data/echo/` are bundled with the app:
- `echo_all.csv`: 2D/Doppler/TDI echo, 5 timepoints (Pre, D7, D70, R+0, R+3)
- `echo_3d.csv`: 3D echo (LV mass, LVEDV, LVESV) by analyst, also D21 and D30. Analysts are coded A1–A3, as in the project database
- `echo_7_subjects.csv`: 7-subject subset used as the "crew"

Derived values (`src/data/echo.js`): SV = EDV − ESV, EF, cardiac output = SV × HR, FS, E/A, E/e′, Tei index, RVSP = 4·TR² + 3 (RAP 3 mmHg, Rudski 2010; same as the database).
Each metric is checked against a clinical range and its % change from the subject's own Pre value. Rules: `src/sim/heart.js`.

When the API is available, the values come from `data/health_monitor.sqlite` (same CFT70 files, imported with quality flags; derived metrics computed in the database) and Countermeasures adds the backend's Welch t-test and Hedges' g vs Control.

## Screens
- **Heart monitor**: echo table by timepoint, interactive heart beating at the measured heart rate, cardiac score by chamber, LV mass vs baseline, findings and actions, % change timeline. ▶ Replay walks through the study.
- **Countermeasures**: group comparison (Control −13.7 % LV mass at D70 vs Exercise B −2.9 %) and crew table.
- **Daily check-in**: mood, stress, sleep, symptoms (saved in the browser).

## Structure
```
src/data/        echo.js (API loading with CSV fallback, derived metrics) · config.js (status levels, data-only mode) · echo/*.csv
src/sim/         heart.js (metric status, chambers, findings, countermeasures) · history.js (check-ins)
src/components/  Heart.jsx · TimelineChart.jsx · ui.jsx · Emoji.jsx
src/views/       HeartMonitor · Countermeasures · CheckIn · Panels (drawer)
api/             [...path].js (Vercel function that runs ../backend)
```
