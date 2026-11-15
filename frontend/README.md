# ORBIT CARE — Astronaut Health Monitor (frontend)

NASA Space Apps 2026 · "Create Health Monitoring Software for Astronauts on Space Missions".
Design: Dark/Tech + Glass/Modern, Roboto font bundled locally.

## Run
```bash
npm install
npm run dev        # http://localhost:5173 (run the backend first: cd ../backend && npm start)
npm run build      # static build in dist/ (this is what Vercel deploys)
npm run lint
```
Vite proxies `/api` to `http://localhost:8000`. On Vercel, `api/index.js` serves the same API on the same domain. `VITE_API_URL` points the app to an API on another domain. The header says where the data comes from: **Live from the project database (API)** or **Offline: bundled CFT70 echo files**.

## Layers
The code is split in layers; each layer only uses the ones below it.

| Layer | Folder | What it holds |
|---|---|---|
| App | `src/app/` | `App.jsx`: navigation, state, which screen and tour are open |
| UI | `src/ui/` | `views/` (screens), `components/` (heart, ECG, charts, tour, cards), `styles/index.css` |
| Domain | `src/domain/` | Rules, no fetching or drawing: `heart.js` (metric status, chambers, findings), `alerts.js` (crew alerts in English from the API fields, offline fallback), `bone.js` (bone loss vs scanner error), `live.js` (simulated pulse and SpO₂), `history.js` (check-ins), `tour.js` (tour steps), `config.js` (status levels) |
| Data | `src/data/` | Where the data comes from: `api.js` (HTTP client), `echo.js` (echo from the API, CSV fallback, gap filling, derived values), `bone.js` (bone density from the API), `alerts.js` (crew alerts from the API), `csv/` (bundled CFT70 files) |
| Server | `api/index.js` | Vercel function that runs `../backend` |

```
src/
├── main.jsx            entry: loads the data, then draws the app
├── app/App.jsx
├── ui/views/           HeartMonitor · Countermeasures · CheckIn · BoneDensity · Panels (drawer)
├── ui/components/      AlertBanner · Heart · Ecg · TimelineChart · Tour · ui · Emoji
├── ui/styles/index.css
├── domain/             heart · alerts · bone · live · history · tour · config
└── data/               api · echo · alerts · bone · csv/
```

## Screens
- **Heart monitor**: crew alert banner at the top, interactive heart beating at the measured heart rate, cardiac score by region, findings, % change timeline, health tips and the echo table. ▶ Replay walks through the study.
- **Countermeasures**: group comparison (Control −13.7 % LV mass at D70 vs Exercise B −2.9 %) with the backend's Welch t-test and Hedges' g vs Control, and the crew table.
- **Daily check-in**: mood, stress, energy, sleep and symptoms with instant guidance; last 7 days and badges update on save. Kept in memory only (it restarts when the page reloads or another subject is loaded).
- **Bone density**: which bones lose density in bed rest (NASA MR035G DXA, 74 subjects). Diverging bars of the mean change by region with the 95 % CI and the scanner error band (LSC), what to watch, and each subject's timeline by region and visit. Needs the API (there is no offline copy of the bone data).

**Crew alerts:** the banner at the top of the Heart monitor shows the subject's alerts at the chosen timepoint: how many are critical or need attention, the most urgent one with its action, and **See all** with why, what to do and the countermeasure for each. The number on the Heart monitor tab counts them.
- Source: `/api/subjects/:id?timepoint=` (alert rules of the database, filtered by measurement error, plus the CUSUM trend alarm), read by `src/data/alerts.js`.
- English text: written in `src/domain/alerts.js` from the structured fields (`rule_id`, `metric_name_en`, `pct_change`), because the database stores the texts in Spanish.
- Offline: falls back to the findings computed in the app (`domain/heart.js`) and says so.

**Guided tour:** each screen has a short tour that highlights its real elements (`src/domain/tour.js`, `src/ui/components/Tour.jsx`). It opens the first time a screen is visited and again with **How it works**. Next / Back / Skip, arrow keys or Esc.

**Live vitals:** pulse and SpO₂ marked LIVE SIM are **simulated** every second; the pulse starts from the measured heart rate. The ECG in Rate & timing is simulated too. Nothing is written to the database.

## Data
NASA **BRSMCF CFT70** echo, 37 subjects, 4 groups (Control, Exercise A, Exercise B, Flywheel). Loaded from the API (`/api/study/cft70/echo-data`); the CSV files in `src/data/csv/` are the offline fallback. Analysts are coded A1–A3.

- **Derived values:** SV = EDV − ESV, EF, cardiac output = SV × HR, FS, E/A, E/e′, Tei index, RVSP = 4·TR² + 3 (RAP 3 mmHg, Rudski 2010).
- **Gap filling:** a value missing at a timepoint is completed from the same database (same subject at the nearest timepoint → group mean → all subjects). Filled cells are shown in *italics* with the origin on hover; group statistics use only measured values. About 2,600 shown values are filled, next to 6,400 measured ones.
- **Status:** each metric is checked against a clinical range and its % change from the subject's own Pre value (`src/domain/heart.js`).

Terms and abbreviations: [`../docs/GLOSSARY.md`](../docs/GLOSSARY.md). Bone data and method: [`../docs/BONE_DENSITY.md`](../docs/BONE_DENSITY.md).
