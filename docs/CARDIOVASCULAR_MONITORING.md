# Cardiovascular Monitoring and Prevention Logic

This document describes **which cardiovascular problems spaceflight causes**, what the real data shows, how the monitor detects each problem early, and what preventive action it recommends. The knowledge (ranges, thresholds, rules, regions) is stored in `data/health_monitor.sqlite`. The backend applies it in `backend/src/services/assessment.js` and computes the statistics in `backend/src/services/analytics.js`.

All results below are computed from the **real NASA CFT70 data**. No synthetic data is used (since v4).

---

## 1. The problem

Without gravity, blood and fluids shift towards the head. The body reads this as excess volume and eliminates plasma, and the heart works less. Within days to weeks:

1. **Plasma volume falls**, so less blood fills the heart (lower preload).
2. **Stroke volume falls**. The heart compensates with a **faster heart rate**.
3. **The left ventricle loses muscle mass** (cardiac atrophy).
4. On returning to gravity (Moon, Mars, Earth), blood pools in the legs. Pressure drops, heart rate rises, and the astronaut may faint (**orthostatic intolerance**).

### What the real data shows: NASA CFT70 / BRSMCF

70 days of 6° head-down bed rest (the standard ground analogue of microgravity), with echocardiography of 37 subjects in 4 groups. Mean change from 2 days before bed rest (Pre) to day 70 (D70), with Welch's t-test and Hedges' g against Control:

| Metric | Control (n=11) | Exercise A | Exercise B | Flywheel |
|---|---|---|---|---|
| LV mass (3D) | **−13.7 %** (p<0.001) | −7.1 % (g 0.72, p=0.14) | **−2.9 %** (g 1.21, p=0.011) | −4.9 % (g 1.00, p=0.033) |
| Stroke volume (3D) | **−14.3 %** (p=0.002) | +0.5 % (g 1.09, p=0.053) | −4.8 % (g 1.00, p=0.025) | −7.1 % (g 0.72, p=0.098) |
| LVOT velocity-time integral | **−21.0 %** (p<0.001) | −6.6 % (g 1.43, p=0.013) | **−0.5 %** (g 2.18, p<0.001) | −7.5 % (g 1.05, p=0.063) |
| Heart rate (during TDI) | +16.7 % (p=0.066) | +2.5 % | +8.5 % | +15.9 % |
| Mitral E/A ratio | **−33.2 %** (p<0.001) | −3.9 % (g 1.25, p=0.030) | −10.1 % (g 0.98, p=0.041) | −22.4 % (g 0.63, p=0.19) |
| Cardiac output (derived) | −0.1 % | +5.2 % | +3.3 % | +7.5 % |

Four hours after getting up (R+0), the Control group's heart rate was **+51 %** above baseline and the LVOT VTI **−31 %**.

**Conclusions from the data:**
- The heart becomes smaller and fills less, but keeps pumping normally (ejection fraction is preserved). This is disuse atrophy, not heart failure.
- **Cardiac output stays flat** because the heart rate rises to compensate for the lower stroke volume. A normal cardiac output does **not** rule out deconditioning.
- **Exercise is the main preventive measure.** Every exercise protocol lost less than Control. The differences *between* exercise protocols are not significant, so what matters most is exercising at all.
- **LVOT VTI is the best single signal.** It separates Control from exercise with the largest effect (g = 2.18) and it is a 2D Doppler measurement, simpler than 3D echo.

## 2. Cardiovascular problems tracked (`cv_problem`)

| # | Problem | Phase | Monitored with | Prevention / treatment |
|---|---|---|---|---|
| 1 | Orthostatic intolerance | Landing | R+0 heart rate and LVOT VTI; orthostatic test ranges (`hr_orthostatic_increase`, `sbp_orthostatic_drop`) | Fluid loading, compression garment, exercise; midodrine under medical supervision |
| 2 | Cardiac atrophy | In flight | `lv_mass`, `lvef` | ISS-like exercise, flywheel |
| 2 | Reduced stroke volume (hypovolemia) | In flight | `stroke_volume`, `lvedv`, `lvot_vti`, `cardiac_output` | Exercise, fluid loading |
| 3 | Tachycardia and palpitations | Any | `hr_tdi_left` (resting supine heart rate) | Medical consult, exercise and fluid plan |
| 3 | Blood pressure dysregulation | Any | Reference ranges only (CFT70 has no blood pressure) | Medical consult |
| 3 | Radiation-induced circulatory disease | Any | Reference dose rates and NASA circulatory limits | Radiation shelter |
| 4 | Diastolic filling changes | In flight | `e_a_ratio`, `e_e_prime_avg`, `e_prime_*`, `tei_index` | Exercise, fluid loading |

Hypoxemia and fever were removed in v4: they are not cardiovascular problems and there is no real data for them.

## 3. Derived metrics (formulas)

Computed from the real measurements and stored in `study_echo_measurement` with `method = 'DERIVED'` and the formula in `comment`:

| Metric | Formula | Why it helps |
|---|---|---|
| Stroke volume | LVEDV − LVESV (3D) | Blood pumped per beat |
| Ejection fraction | SV / LVEDV × 100 | Pump function; should stay normal in atrophy |
| **Cardiac output** | SV × heart rate / 1000 (L/min) | Shows the heart-rate compensation |
| **Tei index** (myocardial performance) | (IVCT + IVRT) / LV ejection time | Combines systolic and diastolic time intervals |
| **RV systolic pressure** | 4 × (TR velocity in m/s)² + 3 mmHg | Pulmonary pressure. Right atrial pressure not measured; 3 mmHg is the normal value (Rudski 2010) |
| **Average E/e′** | E / mean(septal e′, lateral e′) | ASE 2016 filling-pressure criterion |
| E/A, lateral E/e′, fractional shortening | Standard ratios | Diastolic and systolic function |

## 4. How the monitor decides

### 4.1 Status of each metric (`evaluateMetric`)
1. **Absolute range** (`medical_reference`, clinical guidelines):
   ```text
   critical  if value <= critical_low  or value >= critical_high
   warning   if value <  normal_min    or value >  normal_max
   ```
   ASE 2015: EF 52–72 %, RV S′ ≥ 9.5 cm/s · ASE 2016: average E/e′ ≤ 14, septal e′ ≥ 7, lateral e′ ≥ 10, TR ≤ 2.8 m/s · Rudski 2010: RVSP ≤ 35 mmHg · NEWS2: heart rate 45–90, critical ≤ 40 or ≥ 131 bpm.
2. **Change from the subject's own baseline** (`change_threshold`): each person is compared with their own pre-bed-rest value, because normal ranges vary between people.

   | Metric | Warning | Critical |
   |---|---|---|
   | LV mass | −5 % | −10 % |
   | LV end-diastolic volume | −7 % | −12 % |
   | Stroke volume | −7 % | −12 % |
   | LVOT VTI | −10 % | −20 % |
   | E/A ratio | −20 % | −30 % |
   | Resting heart rate (TDI) | +10 % | +20 % |
   | Tei index | +20 % | +35 % |
3. **Measurement error filter (new in v4).** If a 3D change is smaller than the **minimum detectable change** (MDC95, section 5.2), it cannot be told apart from reading error, so its status is lowered one level (critical → warning, warning → normal) and flagged `within_measurement_error`.
4. The final status is the worse of the absolute and the change-based status. Each metric also gets a **severity** from 0 to 1:
   ```text
   change below warning:      0   → 0.3
   between warning and crit:  0.3 → 0.7
   beyond critical:           0.7 → 1 (at 2 × critical)
   absolute warning = 0.5 · absolute critical = 1
   ```

### 4.2 Cardiac score by region (`regionScores`)
The metrics are grouped into the five regions of the frontend heart (`cardiac_region`, `region_metric`):

| Region | Weight | Metrics (weight) |
|---|---|---|
| Left ventricle | 0.30 | LV mass (3), LVEDV (2), stroke volume (2), EF (2) |
| Aortic outflow | 0.25 | LVOT VTI (3); cardiac output (informative only) |
| Rate & timing | 0.20 | Resting heart rate (3), Tei index (1) |
| Mitral valve | 0.15 | E/A (2), average E/e′ (2), septal e′ (1), lateral e′ (1) |
| Right ventricle | 0.10 | RV S′ (2), RVSP (1), TR velocity (1) |

```text
region score  = 100 × (1 − Σ weight × severity / Σ weight)
overall score = Σ region weight × region score / Σ region weight
status        = Nominal ≥ 80 · Attention 60–79 · Critical < 60
```
Safety rule: a value beyond a **clinical critical limit** (for example heart rate ≤ 40 bpm) makes the region and the overall status critical, whatever the score. If any region is critical, the overall status is at least Attention.

The weights and bands are project heuristics (`SRC_PROJECT`). The first version used "worst metric wins": 31 of 38 subjects were critical at D70 and the alert stopped being useful, so the score bands were adopted.

### 4.3 Diastolic function (ASE/EACVI 2016)
Uses the criteria available in CFT70: average E/e′ > 14, septal e′ < 7 or lateral e′ < 10 cm/s, TR velocity > 2.8 m/s. Left atrial volume was not measured. Dysfunction if more than half of the available criteria are positive, normal if fewer than half, indeterminate if exactly half.

### 4.4 Alerts and recommendations
Each non-normal metric is matched to an `alert_rule` (25 rules), which gives the condition, the **recommended action**, the **countermeasure** and the source. The recommendations also include:
- **Group evidence:** the best exercise protocol at that timepoint against Control.
- **Countermeasure plan:** if the subject has no exercise countermeasure, the protocol with the smallest LV mass loss at D70 is recommended (Exercise B, −2.9 %).

## 5. Data mining

All computed by the backend from the real data at start-up. Endpoints under `/api/analytics`.

### 5.1 Group effects (`/api/study/cft70/effects`)
For each group, timepoint and metric: mean % change, SD, 95 % confidence interval, one-sample t-test against "no change", and against Control: difference with 95 % CI, Welch's t-test and Hedges' g with its magnitude.

### 5.2 Reliability of the 3D echo (`/api/analytics/reliability`)
Two analysts (A2 and A3) read the same 3D images. This allows measuring the reading error:

| Metric | Pairs | ICC(2,1) | SEM % | MDC95 one reader | MDC95 mean of two |
|---|---|---|---|---|---|
| LV mass | 189 | 0.944 | 3.3 % | 9.1 % | **6.5 %** |
| LV end-diastolic volume | 186 | 0.930 | 4.2 % | 11.6 % | **8.2 %** |
| LV end-systolic volume | 186 | 0.890 | 6.2 % | 17.1 % | 12.1 % |
| Stroke volume | 186 | 0.852 | 6.6 % | 18.2 % | **12.9 %** |
| Ejection fraction | 186 | 0.516 | 3.7 % | 10.3 % | 7.3 % |
| Cardiac output | 161 | 0.869 | 7.0 % | 19.3 % | 13.6 % |

**What this means:**
- An LV mass change smaller than ~6.5 % cannot be told apart from reading error. The −5 % warning threshold is below this limit, so the measurement error filter (4.1.3) applies.
- Stroke volume needs about a 13 % change to be real. Its 12 % critical threshold sits right at the noise level.
- Ejection fraction agreement is only moderate (ICC 0.52): small EF changes are unreliable.
- This is reading error only, not the variation from acquiring a new image, so the true error is larger.

### 5.3 Early predictors (`/api/analytics/predictors`)
Simple linear regression on each subject's % change, with Benjamini-Hochberg correction (q) within each set. Significant results (q < 0.05):

| Predictor | Outcome | r | q | Reading |
|---|---|---|---|---|
| LV mass change at D7 | LV mass change at D70 | +0.58 | 0.008 | Early mass loss continues: each −10 % at D7 → about −6.3 % more at D70 |
| E/A change at D70 | Heart rate rise at R+0 | −0.61 | <0.001 | Lower filling in bed rest → larger heart-rate jump on getting up |
| Heart rate change at D70 | Heart rate rise at R+0 | +0.50 | 0.007 | Tachycardia in bed rest anticipates tachycardia on return |
| LVOT VTI change at D70 | Heart rate rise at R+0 | −0.49 | 0.008 | Lower outflow → more orthostatic stress |
| LV mass change at D70 | Heart rate rise at R+0 | −0.47 | 0.009 | Atrophy → more orthostatic stress |

The heart-rate rise at R+0 is used as a proxy of orthostatic stress, because CFT70 has no tilt test or blood pressure. In practice: **the echo at the end of the mission identifies who needs fluid loading and compression before landing.**

### 5.4 Correlations (`/api/analytics/correlations`)
Pearson and Spearman correlation matrix of the % changes, with Benjamini-Hochberg q values. At D70, 3 of 36 pairs are significant: stroke volume with LVEDV (r = 0.92), heart rate with cardiac output (r = 0.76) and stroke volume with cardiac output (r = 0.50).

### 5.5 Response phenotypes (`/api/analytics/phenotypes`)
k-means++ (50 restarts, fixed seed) on the standardized D70 changes of LV mass, stroke volume, LVOT VTI, heart rate and E/A. Each subject also gets a **deconditioning index**: the mean z-score with the adverse sign, where 0 is the study average and positive is worse.

| Phenotype (k = 2) | Subjects | Index | Control | Exercise A | Exercise B | Flywheel |
|---|---|---|---|---|---|---|
| High deconditioning | 12 | +0.64 | **8** | 1 | 1 | 2 |
| Protected | 22 | −0.35 | 2 | 6 | 8 | 6 |

Using only how the heart responded, without knowing the group, the clustering puts 8 of the 10 Control subjects with full data in the high-deconditioning phenotype. The silhouette is low (0.21): responses form a continuum, so the index is more informative than the label.

## 6. Validation (in-sample)

| Check | Result |
|---|---|
| Pre bed rest | All 38 subjects are Nominal (score ≥ 80) |
| D70 mean score | Control 53 · Flywheel 71 · Exercise A 81 · Exercise B 83 |
| D70 status | Control: 9 critical, 2 attention · Exercise groups: 1 critical out of 26 |
| AUC Control vs exercise | D7 0.74 · **D70 0.97** · R+0 0.95 · R+3 0.83 |
| Trajectory | Score falls during bed rest, is lowest at R+0 and recovers at R+3 |
| Frontend design | Values match the new design (e.g. subject 6546 at D70: LVEDV −30 %, SV −34 %, CO 4.3 L/min, HR 74 bpm) |

This is **not** an independent validation: the change thresholds were derived from the same CFT70 data. A real validation would need another cohort or spaceflight data.

## 7. Limitations

- Bed rest is an analogue of microgravity, not spaceflight itself.
- CFT70 groups are small (7–11 subjects per group); many group differences have wide confidence intervals.
- The change thresholds, region weights and score bands are project heuristics derived from group means and must be reviewed with medical advice.
- The units of the echo variables are not stated in the source files. They were inferred from their value ranges (`metric.unit_note`).
- CFT70 has no blood pressure, SpO₂, tilt test or continuous heart rate; orthostatic risk is estimated from the R+0 echo.
- RVSP assumes a right atrial pressure of 3 mmHg; the true value was not measured.
- This is an educational prototype, not a medical device.
