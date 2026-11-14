# Cardiovascular Monitoring and Prevention Logic

This document describes **which cardiovascular problems spaceflight causes**, what the data shows, how the monitor detects each problem early, and what preventive action it recommends. Everything described here is stored in `data/health_monitor.sqlite`. The backend applies it in `backend/src/services/alerts.js`.

---

## 1. The problem

Without gravity, blood and fluids shift towards the head. The body reads this as excess volume and eliminates plasma, and the heart works less. Within days to weeks:

1. **Plasma volume falls**, so less blood fills the heart (lower preload).
2. **Stroke volume falls**. The heart compensates with a **faster heart rate**.
3. **The left ventricle loses muscle mass** (cardiac atrophy).
4. On returning to gravity (Moon, Mars, Earth), blood pools in the legs. Pressure drops, heart rate rises, and the astronaut may faint (**orthostatic intolerance**).

Fever, low oxygen saturation and radiation add load on a heart that is already deconditioned.

### What the real data shows: NASA CFT70 / BRSMCF

70 days of 6° head-down bed rest (the standard ground analogue of microgravity), with echocardiography of 37 subjects. Mean change from 2 days before bed rest (BR-2) to day 70 (BR70):

| Metric | Control (no exercise) | Exercise A | Exercise B | Flywheel |
|---|---|---|---|---|
| LV mass (3D) | **−13.7 %** | −7.1 % | −2.9 % | −4.9 % |
| Stroke volume (3D) | **−14.3 %** | +0.5 % | −4.8 % | −7.1 % |
| LVOT velocity-time integral | **−21.0 %** | −6.6 % | −0.5 % | −7.5 % |
| Heart rate (during TDI) | **+16.7 %** | +2.5 % | +8.5 % | +15.9 % |
| Mitral E/A ratio | **−33.2 %** | −3.9 % | −10.1 % | −22.4 % |
| LV ejection fraction | −0.1 % | +0.7 % | +1.6 % | +0.2 % |

Four hours after getting up (R+0), the Control group's heart rate was **+51 %** above baseline.

**Conclusion:** the heart becomes smaller and fills less, but keeps pumping normally (ejection fraction is preserved). This is disuse atrophy, not heart failure. **Exercise is the main preventive measure.** The ISS-like equipment protected better than a single compact flywheel device.

## 2. Cardiovascular problems tracked (`cv_problem`)

| # | Problem | Phase | Monitored with | Prevention / treatment |
|---|---|---|---|---|
| 1 | Orthostatic intolerance | Landing | `hr_orthostatic_increase`, `sbp_orthostatic_drop` | Fluid loading, compression garment, exercise; midodrine under medical supervision |
| 2 | Cardiac atrophy | In flight | `lv_mass`, `lvef`, `exercise_minutes` | ISS-like exercise, flywheel |
| 2 | Reduced stroke volume (hypovolemia) | In flight | `stroke_volume`, `lvedv`, `lvot_vti` | Exercise, fluid loading |
| 2 | Hypoxemia | Any | `spo2` | Medical consult, cabin atmosphere check |
| 3 | Tachycardia and palpitations | Any | `heart_rate`, `resting_heart_rate` | Rest and re-measure, medical consult, exercise |
| 3 | Blood pressure dysregulation | Any | `systolic_bp`, `diastolic_bp` (5 min and daily mean) | Medical consult |
| 3 | Fever and infection | Any | `body_temp` | Rest, medical consult |
| 3 | Radiation-induced circulatory disease | Any | `radiation_dose_rate`, `dose_rate_spike_ratio`, cumulative doses | Radiation shelter |
| 4 | Diastolic filling changes | In flight | `e_a_ratio`, `e_e_prime_ratio` | Exercise, fluid loading |

## 3. How the monitor decides

### 3.1 Status of each measurement
- **Absolute ranges** (`medical_reference`) apply to vital signs and some echo values:
  - NEWS2: heart rate, SpO₂, temperature, systolic critical limits.
  - ACC/AHA: blood pressure.
  - ASE: ejection fraction, E/e′.
  - Freeman 2011: orthostatic tests.
  - NASA-STD-3001: radiation limits.

  ```text
  critical  if value <= critical_low  or value >= critical_high
  warning   if value <  normal_min    or value >  normal_max
  ```
- **Change from the personal baseline** (`change_threshold`) applies to echocardiography and resting heart rate. Each astronaut is compared with their own pre-flight value, because normal ranges vary between people. The thresholds sit between what CFT70 measured with and without exercise:

| Metric | Warning | Critical |
|---|---|---|
| LV mass | −5 % | −10 % |
| LV end-diastolic volume | −7 % | −12 % |
| Stroke volume | −7 % | −12 % |
| LVOT VTI | −10 % | −20 % |
| E/A ratio | −20 % | −30 % |
| Resting heart rate | +10 % | +20 % |

The final status is the worse of the absolute and the change-based status.

### 3.2 From status to alert (`backend/src/services/alerts.js`)
| Source | Rule |
|---|---|
| Vital signs (5 min) | **Critical** if any point in the last 60 min is critical. **Warning** if 3 or more points in that window are out of range. Exercise periods are excluded, because a high heart rate during the countermeasure is expected |
| History (daily, echo, orthostatic, exercise, dose) | Status of the latest record of each metric |
| Module (radiation) | Dose-rate spikes in the last 60 min, applied to the whole mission crew |

Each alert is matched to an `alert_rule` (30 rules). The rule gives:
- the condition that was met;
- the **recommended action**;
- the **countermeasure**;
- the source of the threshold.

### 3.3 Risk index
- `risk.level`: the highest alert level.
- `risk.score` (0–100): Σ (critical = 30, warning = 10) × (1 + (5 − problem severity rank) / 5), capped at 100.
- `risk.by_problem`: the level reached by each cardiovascular problem.

### 3.4 Episodes in the last 24 h
Consecutive out-of-range points (outside exercise) are grouped into episodes with start time, duration and peak. This shows events that have already resolved, such as a 30-minute palpitation episode six hours ago or a solar particle event.

## 4. Prevention workflow

1. **Continuous (5 min):** heart rate, blood pressure, SpO₂ and temperature catch acute events (palpitations, fever, hypoxemia).
2. **Daily:** resting heart rate and daily mean blood pressure catch slow trends, the first sign of volume loss. Exercise minutes track adherence to the main countermeasure.
3. **Every 14 days:** echocardiography detects cardiac atrophy and stroke volume loss before symptoms appear.
4. **Before and after a change of gravity:** orthostatic tests guide fluid loading and compression garments before landing.
5. **Always:** radiation dose rate (shelter during solar events) and cumulative dose against the circulatory limits.

## 5. Simulated crew (demo data)

Sixteen anonymous crew members on four missions show every problem. The injected events are stored in the `event` table:

| Event | Crew / mission | Problem |
|---|---|---|
| EVT01 | CREW-LEO-02 | Palpitations at rest (135–150 bpm, 30 min) |
| EVT02 | SIM-MARS module | Solar particle event (~30× dose rate) |
| EVT03 | CREW-MARS-03 | Fever and low SpO₂ (respiratory infection) |
| EVT04 | CREW-LEO-04 | Skipped exercise for 4 weeks: LV mass −11 %, stroke volume −12 % (like the CFT70 Control group) |
| EVT05 | CREW-LEO-03 | Rising blood pressure |
| EVT06 | SIM-MOON | Orthostatic intolerance on arrival at 1/6 g |
| EVT07 | SIM-RETURN | Re-adaptation to 1 g after 6 months in orbit |
| EVT08 | CREW-MARS-01 | Low flywheel adherence: resting heart rate +22 %, stroke volume −13 % |

## 6. Limitations

- Crew data is synthetic. Only the CFT70 echocardiography and the NASA evidence tables are real.
- Bed rest is an analogue of microgravity, not spaceflight itself.
- CFT70 groups are small (7–11 subjects per group). The change thresholds are project heuristics derived from group means and must be reviewed with medical advice.
- The units of the echo variables are not stated in the source files. They were inferred from their value ranges (`metric.unit_note`).
- This is an educational prototype, not a medical device.
