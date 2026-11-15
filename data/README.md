# Data

**`data/health_monitor.sqlite`** is the project database: SQLite, about 3.6 MB, versioned in the repository. The backend reads it directly in read-only mode.

**Focus:** cardiovascular problems caused by spaceflight (orthostatic intolerance, cardiac atrophy, reduced stroke volume, tachycardia, blood pressure, diastolic changes, radiation-induced circulatory disease), measured on the **real NASA CFT70 echocardiography** of 37 bed-rest subjects.

> Only real data and knowledge with a cited source. No synthetic data since v4. No personal data: study subjects keep NASA's anonymous codes and the 3D image analysts are coded A1–A3.
> Sources: [`docs/DATA_SOURCES.md`](../docs/DATA_SOURCES.md) · Method: [`docs/DATA_METHODOLOGY.md`](../docs/DATA_METHODOLOGY.md) · Monitoring logic: [`docs/CARDIOVASCULAR_MONITORING.md`](../docs/CARDIOVASCULAR_MONITORING.md)

## Tables

| Group | Table | Rows | Content |
|---|---|---|---|
| Knowledge | `cv_problem` | 7 | Cardiovascular problems: mechanism, evidence, consequence, phase, severity |
| | `metric` | 48 | Metrics with unit, category, problem, derived flag and unit notes |
| | `medical_reference` | 25 | Absolute normal and critical ranges from clinical guidelines |
| | `change_threshold` | 7 | % change from the personal baseline that triggers warning or critical |
| | `countermeasure` / `problem_countermeasure` | 8 / 18 | Countermeasures and which problem each one prevents or treats |
| | `alert_rule` | 25 | Condition → level → recommended action → countermeasure |
| | `source` | 26 | Citations (DOIs verified) |
| Real study (NASA CFT70) | `study`, `study_group`, `study_subject`, `study_timepoint` | 1 / 5 / 38 / 7 | 70-day bed rest study, groups, subjects and timepoints (with short labels Pre, D7 … R+3) |
| | `study_echo_measurement` | 8,753 | 7,890 imported echo values (2D/Doppler/TDI and 3D, with quality flag) + 863 derived values |
| Cardiac score | `cardiac_region`, `region_metric` | 5 / 15 | Heart regions shown by the frontend and the metrics (with weights) that make up each one |
| NASA evidence | `nasa_dataset`, `nasa_experiment`, `nasa_dataset_experiment`, `nasa_evidence_finding` | 829 / 158 / 2,592 / 237 | Public LSDA records related to cardiovascular function |

Views: `v_study_3d_mean` (3D echo averaged over analysts), `v_problem_evidence`.

### Derived metrics (`method = 'DERIVED'`)

| Metric | Formula (stored in the `comment` column) |
|---|---|
| `stroke_volume`, `lvef` | LVEDV − LVESV; SV / LVEDV × 100 (per 3D analyst) |
| `cardiac_output` | stroke_volume × hr_tdi_left / 1000 (per 3D analyst) |
| `tei_index` | (ivct + ivrt) / lv_et |
| `rvsp` | 4 × (tricuspid_regurgitation / 100)² + 3 |
| `e_e_prime_avg` | mitral_e / ((e_prime_septal + e_prime_lateral) / 2) |
| `e_a_ratio`, `e_e_prime_ratio`, `fractional_shortening` | mitral_e / mitral_a; mitral_e / e_prime_lateral; (lvid_d − lvid_s) / lvid_d × 100 |

## Status rule

```text
critical  if value <= critical_low  or value >= critical_high      (medical_reference)
warning   if value <  normal_min    or value >  normal_max
```

For metrics in `change_threshold`, the % change from the subject's own baseline (BR-2) is also compared with `warning_pct` / `critical_pct`, and the worse result wins. The backend lowers a 3D change by one level when it is smaller than the inter-analyst minimum detectable change. Details: [`docs/CARDIOVASCULAR_MONITORING.md`](../docs/CARDIOVASCULAR_MONITORING.md).

## Usage

```bash
sqlite3 -header -column data/health_monitor.sqlite < data/queries.sql   # example queries
sqlite3 data/health_monitor.sqlite ".schema study_echo_measurement"     # inspect a table
```

The database itself is the source of truth; there are no build scripts in the repository. To change data, use SQL against `data/health_monitor.sqlite`, keep `data/schema.sql` in sync and record the change in `docs/DATA_METHODOLOGY.md`. The schema runs on PostgreSQL as well.
