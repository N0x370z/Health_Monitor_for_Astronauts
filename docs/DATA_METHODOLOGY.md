# Data Methodology and Work Record

Formal record of how the project database (`data/health_monitor.sqlite`) was built. It covers the objective, method, decisions, validation and limitations. Sources are listed in [`DATA_SOURCES.md`](DATA_SOURCES.md); the monitoring logic is in [`CARDIOVASCULAR_MONITORING.md`](CARDIOVASCULAR_MONITORING.md).

---

## 1. Objective

A database that lets the Health Monitor detect, early, the **cardiovascular problems caused by spaceflight** and recommend how to prevent them. It must:

- be grounded on real data (NASA CFT70 echocardiography, NASA LSDA evidence, clinical guidelines);
- cite every threshold;
- contain no personal data;
- be served directly to the backend.

## 2. Real data only (since v4)

Continuous physiological records of real astronauts are privacy-protected, so versions 1 to 3 used a **synthetic** crew calibrated with CFT70. In v4 that crew was **removed**: the monitor now works on the 37 real CFT70 subjects, who play the role of the crew. They are monitored at each echocardiography session (Pre, D7, D21, D30, D70, R+0, R+3) instead of every 5 minutes. This matches the new frontend design, which shows the CFT70 subjects directly.

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
6. Computed the mean change from BR-2 by group and timepoint. The 3D analysts are averaged per subject first. (Stored as `study_effect` until v3; since v4 the backend computes it with confidence intervals and tests.)

### Phase 3. Cardiovascular knowledge base
| Table | Content |
|---|---|
| `cv_problem` | 7 problems, each with mechanism, evidence, consequence, mission phase and severity (9 until v3) |
| `metric` | 48 metrics: 27 2D/Doppler/TDI, 3 3D, 9 derived, reference vital signs, orthostatic and radiation |
| `medical_reference` | 25 absolute ranges (NEWS2, ACC/AHA, ASE 2015 and 2016, Rudski 2010, Freeman, ACSM, NASA-STD-3001) |
| `change_threshold` | 7 change-from-baseline thresholds derived from CFT70 Control vs exercise |
| `countermeasure`, `problem_countermeasure` | 8 countermeasures with NASA evidence |
| `alert_rule` | 25 rules: condition → level → action → countermeasure |
| `cardiac_region`, `region_metric` | 5 heart regions and the 15 metrics that make up the cardiac score (v4) |

### Phase 4. Synthetic crew monitoring (v3, removed in v4)
In v3, 16 synthetic crew members on 4 missions (24 h vital signs every 5 min, daily history, 8 injected events) were used to test the alerts. They were removed in v4 together with the tables `mission`, `crew_member`, `measurement`, `daily_measurement` and `event`.

### Phase 5. Evidence
NASA LSDA result sentences were linked to each cardiovascular problem by keyword rules (241 findings; 237 after removing the non-cardiovascular problems in v4). Datasets and experiments outside the cardiovascular scope were removed.

### Phase 6. Real-data-only database and data mining (v4)
1. **Removed what does not help:** the synthetic crew tables and view, `study_effect` (now computed live), the problems hypoxemia and fever, and the metrics `spo2`, `body_temp`, `exercise_minutes`, `dose_rate_spike_ratio` and `resting_heart_rate` (no real data). Rules, ranges, findings and sources that only served them were removed too. The database went from 9.4 MB to 3.6 MB.
2. **Retargeted** the resting heart-rate threshold, range and rules to `hr_tdi_left`, the heart rate actually measured during the CFT70 echo.
3. **Derived metrics** with clinical formulas: cardiac output, Tei index, RV systolic pressure and average E/e′ (863 new values). The formula of every derived value, including those from v3 (stroke volume, EF, E/A, lateral E/e′, fractional shortening, re-checked against the raw values), is stored in `comment`.
4. **New knowledge:** ranges for average E/e′ (ASE 2016), RV S′ (ASE 2015) and RVSP (Rudski 2010); a change threshold for the Tei index; 3 alert rules; the heart regions of the cardiac score; short timepoint labels (Pre, D7… R+3) used by the frontend.
5. **Data mining in the backend** (`backend/src/services/analytics.js`, details in [`CARDIOVASCULAR_MONITORING.md`](CARDIOVASCULAR_MONITORING.md#5-data-mining)):
   - group effects with 95 % CI, t-tests and Hedges' g;
   - inter-analyst reliability of the 3D echo (ICC, SEM, MDC95, Bland-Altman), used to filter changes within measurement error;
   - correlations with Benjamini-Hochberg correction;
   - early predictors (D7 → D70, D70 → R+0) by linear regression;
   - response phenotypes by k-means++ and a deconditioning index.
6. The migration was applied once with SQL against the database, after a backup. It is summarized here; no script was added to the repository.

### Phase 7. Validation
| Check | Result |
|---|---|
| Foreign keys and integrity | 0 errors (`PRAGMA foreign_key_check`, `integrity_check`) |
| `schema.sql` | Builds an empty database with exactly the same objects as `health_monitor.sqlite` |
| Group effects vs independent SQL (`queries.sql` #2) | Identical (e.g. LV mass, Control D70: −13.7 %) |
| Personal data | No analyst names or personal identifiers in any table |
| Cardiac score | All subjects Nominal before bed rest; AUC Control vs exercise 0.97 at D70 (in-sample) |
| Statistics module | Checked against t tables and an independent numerical integration |
| Backend tests | 25/25 pass (`backend/test/api.test.js`, `backend/test/stats.test.js`) |

### Phase 8. Bone densitometry (v5, NASA MR035G DXA)
1. **Review of the 1,064 files:** 11 export formats (hip regional analysis and summaries, spine, forearm, heel, whole body, body composition, subregions, ReadMe). The same scan appears in up to three files.
2. **Import** with a one-off script outside the repository: generic reading of the `<REGION>_BMD/BMC` columns and of the T/Z summary columns, de-duplication by subject, region, side, parameter and scan ID (38,493 → 19,727), and visit coding from the bed rest phase and day (follow-up files: 6 months, 1 year).
3. **Kept only what is needed to assess bone loss:** 11 regions and 4 parameters. Personal fields (one file had a last-name column; birth dates, ethnicity) and absolute dates were not imported. Scans inside the 2006 scanner recalibration window are flagged.
4. **Extraction of the relevant parameters and structures:** precision and LSC per region from the repeated PRE scans, and the PRE → end-of-bed-rest change per region. Results and ranking in [`BONE_DENSITY.md`](BONE_DENSITY.md). Hip (total, intertrochanteric, trochanter), pelvis, heel and femoral neck are the key regions; forearm and arms are controls.
5. **Backend:** `backend/src/services/bone.js` and `/api/bone…` endpoints; 2 new tests.
6. **Validation:** foreign keys and integrity 0 errors; `schema.sql` builds the same objects as the database; the backend results match an independent SQL query (`queries.sql` #10).

## 4. Build process and scripts

The database was built once with a build script kept **outside the repository**. As of 2026-11-14, the database file itself is the source of truth:

- The Python scripts in `data/scripts/` (reference data, generator, NASA normalization, builder, inspector) were **removed**. Data is no longer shown through them; the backend and frontend read the database directly.
- To change data, edit the database with SQL (see `data/schema.sql` and `data/queries.sql`) and document the change in this file.

## 5. Limitations

- Bed rest is an analogue of spaceflight, not spaceflight. CFT70 has no blood pressure, SpO₂ or continuous heart rate.
- CFT70 groups are small (7–11 per group). The change thresholds, region weights and score bands are heuristics and need medical review.
- The score validation is in-sample: the thresholds come from the same data.
- The units of the echo variables were inferred from their value ranges.
- The 30-day and 1-year NASA limits are in mGy-Eq (organ dose); the database compares them with mSv as an approximation.
- Evidence linking uses keyword rules and can misclassify sentences.

## 6. Change log

| Date | Change |
|---|---|
| 2026-11-14 | Catalog cleaned and enriched through the NLSP portal |
| 2026-11-14 | v1: 41 metrics covering NASA's 5 spaceflight hazards |
| 2026-11-14 | v2: scope reduced to temperature, pressure, cardiovascular, SpO₂ and radiation. Database file versioned. Citations verified |
| 2026-11-14 | v3: cardiovascular focus. CFT70/BRSMCF echocardiography imported. Knowledge base of problems, rules and countermeasures added. Crew data recalibrated with CFT70. Cabin temperature and pressure removed. Python scripts removed. Node.js backend (no framework) and React frontend added |
| 2026-11-15 | **v5: bone densitometry.** NASA MR035G DXA imported into `bone_*` tables (74 subjects, 19,727 measurements, 11 regions, 4 parameters). Precision and LSC per region; ranking of the regions with the largest bone loss. 7 sources added. Size 3.6 → 6.6 MB |
| 2026-11-15 | **Frontend integration.** ORBIT CARE v2 (team branch `v2-frontend`) moved to `frontend/`. In its bundled `echo_3d.csv` the analysts' names were replaced by A1–A3 (same mapping as the database) and RVSP was aligned to RAP 3 mmHg. The app now loads the values from the database through `/api/study/cft70/echo-data` (3,331 values compared with the CSV files: only 2 EF values differ > 2 %, because the database averages EF per analyst). The API runs on Vercel as a function |
| 2026-11-15 | **v4: real data only and data mining.** Synthetic crew, `study_effect` and non-cardiovascular metrics removed. Derived metrics (cardiac output, Tei, RVSP, average E/e′), heart regions and new guideline ranges added. Backend rebuilt around the CFT70 subjects: cardiac score by region, measurement error filter, ASE diastolic assessment, group statistics, reliability, predictors and phenotypes. Malformed URLs return 400 instead of stopping the server; change analyses reject the baseline. 27 tests |

## 7. Tools

SQLite, Python 3 with pandas (one-off build, outside the repository), SQL migrations, Node.js 22 (`node:sqlite`, `node:http`) for the backend, and React, Recharts and Vite for the frontend. Data preparation and code were developed with the help of an AI coding assistant (Claude Code). All sources, values and results are documented so they can be checked independently.
