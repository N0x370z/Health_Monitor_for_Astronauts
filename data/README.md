# Data

**`data/health_monitor.sqlite`** is the project database: SQLite, about 9 MB, versioned in the repository. The backend reads it directly in read-only mode.

**Focus:** cardiovascular problems caused by spaceflight (orthostatic intolerance, cardiac atrophy, reduced stroke volume, tachycardia, blood pressure, diastolic changes) and the factors that affect them (oxygen saturation, fever, radiation).

> No personal data. Real study subjects use NASA's anonymous codes; crew members are pseudonymous and their data is synthetic.
> Sources: [`docs/DATA_SOURCES.md`](../docs/DATA_SOURCES.md) · Method: [`docs/DATA_METHODOLOGY.md`](../docs/DATA_METHODOLOGY.md) · Monitoring logic: [`docs/CARDIOVASCULAR_MONITORING.md`](../docs/CARDIOVASCULAR_MONITORING.md)

## Tables

| Group | Table | Rows | Content |
|---|---|---|---|
| Knowledge | `cv_problem` | 9 | Cardiovascular problems: mechanism, evidence, consequence, phase, severity |
| | `metric` | 49 | Metrics with unit, category, problem, derived flag and unit notes |
| | `medical_reference` | 26 | Absolute normal and critical ranges by context |
| | `change_threshold` | 6 | % change from the personal baseline that triggers warning or critical |
| | `countermeasure` / `problem_countermeasure` | 8 / 21 | Countermeasures and which problem each one prevents or treats |
| | `alert_rule` | 30 | Condition → level → recommended action → countermeasure |
| | `source` | 21 | Citations |
| Real study (NASA CFT70) | `study`, `study_group`, `study_subject`, `study_timepoint` | 1 / 5 / 38 / 7 | 70-day bed rest study, groups, subjects and timepoints |
| | `study_echo_measurement` | 7,890 | Echocardiography values (2D/Doppler/TDI, 3D and derived) with quality flag |
| | `study_effect` | 760 | Mean % change from BR-2 by metric, group and timepoint |
| Crew monitoring (synthetic) | `mission`, `crew_member` | 4 / 16 | Missions and anonymous crew with baselines |
| | `measurement` | 25,344 | Last 24 h every 5 min: heart rate, blood pressure, SpO₂, temperature, radiation |
| | `daily_measurement` | 7,304 | Mission history: resting HR, daily BP, exercise, orthostatic tests, echocardiography, cumulative dose |
| | `event` | 8 | Injected anomalies (ground truth) |
| NASA evidence | `nasa_dataset`, `nasa_experiment`, `nasa_dataset_experiment`, `nasa_evidence_finding` | 829 / 158 / … / 241 | Public LSDA records related to cardiovascular function |

Views: `v_latest_vitals`, `v_study_3d_mean`, `v_problem_evidence`.

## Status rule

```text
critical  if value <= critical_low  or value >= critical_high      (medical_reference)
warning   if value <  normal_min    or value >  normal_max
```

For metrics in `change_threshold`, `daily_measurement.pct_change_from_baseline` is also compared with `warning_pct` / `critical_pct`, and the worse of both results is stored.

## Usage

```bash
sqlite3 data/health_monitor.sqlite < data/queries.sql     # example queries
sqlite3 data/health_monitor.sqlite ".schema cv_problem"   # inspect a table
```

The Python build scripts were removed: the database itself is the source of truth. To change data, use SQL against `data/health_monitor.sqlite` and record the change in `docs/DATA_METHODOLOGY.md`. The schema runs on PostgreSQL as well (`data/schema.sql`).
