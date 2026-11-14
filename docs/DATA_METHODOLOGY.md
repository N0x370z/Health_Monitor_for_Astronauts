# Data Methodology and Work Record

Formal record of how the project database (`data/health_monitor.sqlite`) was built. It covers the objective, method, decisions, validation and limitations. Sources are listed in [`DATA_SOURCES.md`](DATA_SOURCES.md); the monitoring logic is in [`CARDIOVASCULAR_MONITORING.md`](CARDIOVASCULAR_MONITORING.md).

---

## 1. Objective

A database that lets the Health Monitor detect, early, the **cardiovascular problems caused by spaceflight** and recommend how to prevent them. It must:

- be grounded on real data (NASA CFT70 echocardiography, NASA LSDA evidence, clinical guidelines);
- cite every threshold;
- contain no personal data;
- be served directly to the backend.

## 2. Why synthetic crew data

Continuous physiological records of real astronauts are privacy-protected. The real CFT70 data is periodic echocardiography of bed-rest volunteers, not 24-hour monitoring. The crew time series are therefore **synthetic**: they are calibrated with the CFT70 trajectories and the clinical ranges, and include labelled anomalies to test the alert logic.

## 3. Method

### Phase 1. Catalog cleaning and enrichment (NASA LSDA)
1. Cleaned the `by_topic` catalog: 2,593 → 2,390 health-related datasets.
2. Read their public records on the NASA Life Sciences Portal.
3. Linked them to 2,676 experiment records with objectives, approach and results.

### Phase 2. Echocardiography import (NASA CFT70 / BRSMCF)
1. Read the four CSV files and confirmed that the two "7 Subjects" files are identical and a subset of "Echo All Data 2".
2. Normalized timepoints (BR-2, BR7, BR21, BR30, BR70, R+0, R+3) and treatment groups (Control, Exercise A, Exercise B, Flywheel).
3. Converted the data to long format (`study_echo_measurement`): one row per subject, timepoint, metric and 3D analyst.
4. Replaced the 3D analysts' names with codes (A1–A3). Kept the data-quality comments as flags.
5. Derived stroke volume and ejection fraction (3D), E/A, E/e′ and fractional shortening.
6. Computed `study_effect`: mean change from BR-2 by group and timepoint. The 3D analysts are averaged per subject first.

### Phase 3. Cardiovascular knowledge base
| Table | Content |
|---|---|
| `cv_problem` | 9 problems, each with mechanism, evidence, consequence, mission phase and severity |
| `metric` | 49 metrics: 27 echo, 3 3D, 5 derived, vital signs, orthostatic, radiation and exercise |
| `medical_reference` | 26 absolute ranges (NEWS2, ACC/AHA, ASE, Freeman, ACSM, NASA-STD-3001) |
| `change_threshold` | 6 change-from-baseline thresholds derived from CFT70 Control vs exercise |
| `countermeasure`, `problem_countermeasure` | 8 countermeasures with NASA evidence |
| `alert_rule` | 30 rules: condition → level → action → countermeasure |

### Phase 4. Synthetic crew monitoring
- 4 missions (low Earth orbit, Moon, Mars transit, return to Earth) with 16 anonymous crew members.
- Last 24 h every 5 min: heart rate, blood pressure, SpO₂, temperature, and module radiation.
- Daily history: resting heart rate, daily mean blood pressure, exercise minutes, orthostatic tests, cumulative radiation dose.
- Echocardiography every 14 days. Trajectories follow the CFT70 group means: ISS-like exercise ≈ Exercise A/B, compact flywheel ≈ Flywheel, no exercise ≈ Control.
- 8 injected events, one or more per problem (`event`).

### Phase 5. Evidence
NASA LSDA result sentences were linked to each cardiovascular problem by keyword rules (241 findings). Datasets and experiments outside the cardiovascular scope were removed.

### Phase 6. Validation
| Check | Result |
|---|---|
| Foreign keys | 0 errors |
| `study_effect` vs independent recomputation from the raw CSV | Identical (e.g. LV mass, Control BR70: −13.7 %) |
| Personal data | No analyst names or personal identifiers in any table |
| Injected events | All 8 raise alerts. CREW-LEO-04 reaches critical LV mass (−11.2 %) and stroke volume (−12.2 %); CREW-MARS-01 reaches critical resting heart rate (+21.6 %) |
| False alarms | Under 1 % of synthetic points outside injected events |
| Backend tests | 9/9 pass (`backend/test/api.test.js`) |

## 4. Build process and scripts

The database was built once with a build script kept **outside the repository**. As of 2026-11-14, the database file itself is the source of truth:

- The Python scripts in `data/scripts/` (reference data, generator, NASA normalization, builder, inspector) were **removed**. Data is no longer shown through them; the backend and frontend read the database directly.
- To change data, edit the database with SQL (see `data/schema.sql` and `data/queries.sql`) and document the change in this file.

## 5. Limitations

- Crew data is synthetic. Bed rest is an analogue of spaceflight, not spaceflight.
- CFT70 groups are small (7–11 per group). The change thresholds are heuristics and need medical review.
- The units of the echo variables were inferred from their value ranges.
- The 30-day and 1-year NASA limits are in mGy-Eq (organ dose); the database compares them with mSv as an approximation.
- Evidence linking uses keyword rules and can misclassify sentences.

## 6. Change log

| Date | Change |
|---|---|
| 2026-11-14 | Catalog cleaned and enriched through the NLSP portal |
| 2026-11-14 | v1: 41 metrics covering NASA's 5 spaceflight hazards |
| 2026-11-14 | v2: scope reduced to temperature, pressure, cardiovascular, SpO₂ and radiation. Database file versioned. Citations verified |
| 2026-11-14 | **v3: cardiovascular focus.** CFT70/BRSMCF echocardiography imported. Knowledge base of problems, rules and countermeasures added. Crew data recalibrated with CFT70. Cabin temperature and pressure removed. Python scripts removed. Node.js backend (no framework) and React frontend added |

## 7. Tools

SQLite, Python 3 with pandas (one-off build, outside the repository), Node.js 22 (`node:sqlite`, `node:http`) for the backend, and React, Recharts and Vite for the frontend. Data preparation and code were developed with the help of an AI coding assistant (Claude Code). All sources, values and results are documented so they can be checked independently.
