-- Health Monitor for Astronauts — esquema de la base de datos cardiovascular (3FN)
-- Archivo: data/health_monitor.sqlite (SQLite). SQL portable a PostgreSQL.
--
-- Grupos de tablas:
--   1. Conocimiento: problemas cardiovasculares del vuelo espacial, métricas, rangos, reglas de alerta,
--      contramedidas y fuentes.
--   2. Estudio real NASA CFT70 / BRSMCF: ecocardiografía de 37 sujetos en 70 días de reposo en cama.
--   3. Monitoreo de tripulación (sintético, anónimo): signos vitales 24 h, historial diario y ecocardiogramas.
--   4. Evidencia NASA LSDA: catálogo público relacionado con la función cardiovascular.

-- ════════════════════ 1. Conocimiento ════════════════════════════════════
CREATE TABLE source (
    source_id    TEXT PRIMARY KEY,
    source_type  TEXT NOT NULL,                 -- clinical_guideline, peer_reviewed, nasa_lsda, space_standard, project_heuristic
    citation     TEXT NOT NULL,
    url          TEXT,
    notes        TEXT
);

CREATE TABLE cv_problem (                        -- problemas cardiovasculares generados por el vuelo espacial
    problem_code      TEXT PRIMARY KEY,
    name_es           TEXT NOT NULL,
    name_en           TEXT NOT NULL,
    mechanism_es      TEXT NOT NULL,             -- por qué ocurre
    evidence_es       TEXT NOT NULL,             -- qué muestran los datos
    consequence_es    TEXT NOT NULL,             -- qué riesgo implica para la misión
    mission_phase     TEXT NOT NULL,             -- in_flight, landing, post_flight, any
    severity_rank     INTEGER NOT NULL,          -- 1 = más grave
    source_id         TEXT NOT NULL REFERENCES source(source_id)
);

CREATE TABLE metric (
    metric_code     TEXT PRIMARY KEY,
    name_es         TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    unit            TEXT NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('vital', 'echo', 'orthostatic', 'radiation', 'countermeasure', 'environment')),
    problem_code    TEXT REFERENCES cv_problem(problem_code),   -- problema principal que ayuda a vigilar
    scope           TEXT NOT NULL CHECK (scope IN ('crew', 'environment')),
    sampling        TEXT NOT NULL,              -- 5min, daily, echo_session, event
    is_derived      BOOLEAN NOT NULL,           -- calculada a partir de otras métricas
    description_es  TEXT,
    unit_note       TEXT                        -- aclaraciones sobre la unidad (p. ej. inferida)
);

-- Rangos absolutos por métrica y contexto. Estado:
--   critical si value <= critical_low o value >= critical_high
--   warning  si value <  normal_min   o value >  normal_max
CREATE TABLE medical_reference (
    reference_id         TEXT PRIMARY KEY,
    metric_code          TEXT NOT NULL REFERENCES metric(metric_code),
    context              TEXT NOT NULL,         -- any, exercise, daily_mean, post_landing, circulatory_limit, ...
    normal_min           REAL,
    normal_max           REAL,
    critical_low         REAL,
    critical_high        REAL,
    expected_value       REAL,
    note_es              TEXT,
    primary_source_id    TEXT NOT NULL REFERENCES source(source_id),
    evidence_source_id   TEXT REFERENCES source(source_id),
    confidence           TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'needs_verification')),
    UNIQUE (metric_code, context)
);

-- Umbrales de cambio respecto a la línea base personal (para métricas de ecocardiografía y tendencias)
CREATE TABLE change_threshold (
    metric_code        TEXT PRIMARY KEY REFERENCES metric(metric_code),
    direction          TEXT NOT NULL CHECK (direction IN ('decrease', 'increase')),
    warning_pct        REAL NOT NULL,           -- magnitud del cambio (%) que dispara warning
    critical_pct       REAL NOT NULL,
    basis_es           TEXT NOT NULL,           -- de dónde sale el umbral (datos CFT70)
    source_id          TEXT NOT NULL REFERENCES source(source_id),
    evidence_source_id TEXT REFERENCES source(source_id)
);

CREATE TABLE countermeasure (
    countermeasure_code  TEXT PRIMARY KEY,
    name_es              TEXT NOT NULL,
    description_es       TEXT NOT NULL,
    evidence_es          TEXT NOT NULL,
    source_id            TEXT NOT NULL REFERENCES source(source_id)
);

CREATE TABLE problem_countermeasure (           -- qué contramedidas previenen o tratan cada problema
    problem_code         TEXT NOT NULL REFERENCES cv_problem(problem_code),
    countermeasure_code  TEXT NOT NULL REFERENCES countermeasure(countermeasure_code),
    role                 TEXT NOT NULL CHECK (role IN ('prevention', 'treatment', 'monitoring')),
    PRIMARY KEY (problem_code, countermeasure_code)
);

CREATE TABLE alert_rule (                        -- lógica de prevención: condición -> nivel -> acción
    rule_id              TEXT PRIMARY KEY,
    problem_code         TEXT NOT NULL REFERENCES cv_problem(problem_code),
    metric_code          TEXT NOT NULL REFERENCES metric(metric_code),
    condition_type       TEXT NOT NULL CHECK (condition_type IN ('absolute', 'change_from_baseline', 'sustained', 'cumulative')),
    level                TEXT NOT NULL CHECK (level IN ('warning', 'critical')),
    condition_es         TEXT NOT NULL,
    action_es            TEXT NOT NULL,
    countermeasure_code  TEXT REFERENCES countermeasure(countermeasure_code),
    source_id            TEXT NOT NULL REFERENCES source(source_id)
);

-- ════════════════════ 2. Estudio real NASA CFT70 / BRSMCF ═════════════════
CREATE TABLE study (
    study_code      TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    design_es       TEXT NOT NULL,
    source_id       TEXT NOT NULL REFERENCES source(source_id),
    data_source_id  TEXT NOT NULL REFERENCES source(source_id)
);

CREATE TABLE study_group (
    group_code      TEXT PRIMARY KEY,           -- CONTROL, EXERCISE_A, EXERCISE_B, FLYWHEEL, UNASSIGNED
    study_code      TEXT NOT NULL REFERENCES study(study_code),
    name_es         TEXT NOT NULL,
    description_es  TEXT NOT NULL,
    is_countermeasure BOOLEAN NOT NULL
);

CREATE TABLE study_subject (                     -- códigos anónimos asignados por NASA (sin datos personales)
    subject_code       TEXT PRIMARY KEY,         -- S + código NASA
    study_code         TEXT NOT NULL REFERENCES study(study_code),
    group_code         TEXT NOT NULL REFERENCES study_group(group_code),
    in_subset_7        BOOLEAN NOT NULL,         -- incluido en el archivo "Echo 7 Subjects"
    has_2d_echo        BOOLEAN NOT NULL,
    has_3d_echo        BOOLEAN NOT NULL
);

CREATE TABLE study_timepoint (
    timepoint_code  TEXT PRIMARY KEY,            -- BR-2, BR7, BR21, BR30, BR70, R+0, R+3
    phase           TEXT NOT NULL CHECK (phase IN ('PRE_TEST', 'IN_TEST', 'POST_TEST')),
    day_offset      REAL NOT NULL,               -- días desde el inicio del reposo en cama
    sort_order      INTEGER NOT NULL,
    label_es        TEXT NOT NULL,
    raw_labels      TEXT NOT NULL                -- etiquetas originales en los CSV
);

CREATE TABLE study_echo_measurement (            -- formato largo: una fila por sujeto, momento, métrica y analista
    measurement_id   INTEGER PRIMARY KEY,
    subject_code     TEXT NOT NULL REFERENCES study_subject(subject_code),
    timepoint_code   TEXT NOT NULL REFERENCES study_timepoint(timepoint_code),
    metric_code      TEXT NOT NULL REFERENCES metric(metric_code),
    value            REAL,                       -- NULL = no disponible (ver quality_flag)
    method           TEXT NOT NULL CHECK (method IN ('2D_DOPPLER_TDI', '3D', 'DERIVED')),
    analyzer_code    TEXT,                       -- analista anónimo del eco 3D (A1, A2, A3)
    quality_flag     TEXT NOT NULL CHECK (quality_flag IN ('ok', 'missing', 'bad_image', 'not_analyzable', 'dismissed', 'zero_as_missing')),
    comment          TEXT,
    source_file      TEXT NOT NULL
);
CREATE INDEX ix_study_echo ON study_echo_measurement (metric_code, timepoint_code);
CREATE INDEX ix_study_echo_subject ON study_echo_measurement (subject_code);

CREATE TABLE study_effect (                      -- resumen: cambio medio vs BR-2 por grupo y momento
    metric_code        TEXT NOT NULL REFERENCES metric(metric_code),
    group_code         TEXT NOT NULL REFERENCES study_group(group_code),
    timepoint_code     TEXT NOT NULL REFERENCES study_timepoint(timepoint_code),
    n                  INTEGER NOT NULL,
    mean_baseline      REAL,
    mean_value         REAL,
    mean_pct_change    REAL,
    sd_pct_change      REAL,
    PRIMARY KEY (metric_code, group_code, timepoint_code)
);

-- ════════════════════ 3. Monitoreo de tripulación (sintético) ═════════════
CREATE TABLE mission (
    mission_code            TEXT PRIMARY KEY,
    name_es                 TEXT NOT NULL,
    environment_context     TEXT NOT NULL,
    gravity_g               REAL NOT NULL,
    duration_days           INTEGER NOT NULL,
    current_mission_day     INTEGER NOT NULL,
    countermeasure_hardware TEXT NOT NULL,       -- equipo de ejercicio disponible
    description_es          TEXT
);

CREATE TABLE crew_member (                       -- sin nombre, edad ni datos personales
    crew_code              TEXT PRIMARY KEY,
    mission_code           TEXT NOT NULL REFERENCES mission(mission_code),
    role                   TEXT NOT NULL,
    baseline_hr            REAL NOT NULL,
    baseline_sbp           REAL NOT NULL,
    baseline_dbp           REAL NOT NULL,
    baseline_lv_mass       REAL NOT NULL,        -- g (eco 3D pre-vuelo)
    baseline_stroke_volume REAL NOT NULL,        -- mL
    prior_career_dose_msv  REAL NOT NULL
);

CREATE TABLE event (                             -- anomalías inyectadas (verdad de referencia)
    event_id            TEXT PRIMARY KEY,
    mission_code        TEXT NOT NULL REFERENCES mission(mission_code),
    crew_code           TEXT REFERENCES crew_member(crew_code),     -- NULL = módulo / toda la tripulación
    problem_code        TEXT NOT NULL REFERENCES cv_problem(problem_code),
    scale               TEXT NOT NULL CHECK (scale IN ('24h', 'daily')),
    start_ts            TEXT,
    end_ts              TEXT,
    description_es      TEXT NOT NULL
);

CREATE TABLE measurement (                       -- últimas 24 h, cada 5 min
    measurement_id       INTEGER PRIMARY KEY,
    ts                   TEXT NOT NULL,          -- ISO 8601 UTC
    mission_code         TEXT NOT NULL REFERENCES mission(mission_code),
    crew_code            TEXT REFERENCES crew_member(crew_code),   -- NULL = sensor del módulo
    metric_code          TEXT NOT NULL REFERENCES metric(metric_code),
    value                REAL NOT NULL,
    activity             TEXT NOT NULL CHECK (activity IN ('sleep', 'work', 'exercise')),
    status               TEXT NOT NULL CHECK (status IN ('normal', 'warning', 'critical')),
    event_id             TEXT REFERENCES event(event_id)
);
CREATE INDEX ix_measurement_crew_metric_ts ON measurement (crew_code, metric_code, ts);
CREATE INDEX ix_measurement_mission_metric_ts ON measurement (mission_code, metric_code, ts);
CREATE INDEX ix_measurement_status ON measurement (status);

CREATE TABLE daily_measurement (                 -- historial: medias diarias, pruebas ortostáticas, ecos, dosis
    daily_id             INTEGER PRIMARY KEY,
    date                 TEXT NOT NULL,
    mission_day          INTEGER NOT NULL,
    mission_code         TEXT NOT NULL REFERENCES mission(mission_code),
    crew_code            TEXT NOT NULL REFERENCES crew_member(crew_code),
    metric_code          TEXT NOT NULL REFERENCES metric(metric_code),
    value                REAL NOT NULL,
    pct_change_from_baseline REAL,               -- solo métricas con change_threshold
    status               TEXT NOT NULL CHECK (status IN ('normal', 'warning', 'critical')),
    event_id             TEXT REFERENCES event(event_id)
);
CREATE INDEX ix_daily_crew_metric ON daily_measurement (crew_code, metric_code, mission_day);

-- ════════════════════ 4. Evidencia NASA LSDA (pública) ════════════════════
CREATE TABLE nasa_experiment (
    experiment_key  TEXT PRIMARY KEY,
    experiment_id   TEXT,
    title           TEXT,
    program         TEXT,
    species         TEXT,
    archive_status  TEXT,
    objectives      TEXT,
    approach        TEXT,
    results         TEXT,
    has_results     BOOLEAN NOT NULL
);

CREATE TABLE nasa_dataset (
    dataset_id           TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    species              TEXT,
    processing_level     TEXT,
    availability         TEXT,
    file_name            TEXT,
    file_format          TEXT,
    parameters           TEXT,
    description          TEXT,
    nlsp_url             TEXT NOT NULL,
    is_public            BOOLEAN NOT NULL,
    is_machine_readable  BOOLEAN NOT NULL
);

CREATE TABLE nasa_dataset_experiment (
    dataset_id      TEXT NOT NULL REFERENCES nasa_dataset(dataset_id),
    experiment_key  TEXT NOT NULL REFERENCES nasa_experiment(experiment_key),
    PRIMARY KEY (dataset_id, experiment_key)
);

CREATE TABLE nasa_evidence_finding (
    finding_id       TEXT PRIMARY KEY,
    experiment_key   TEXT NOT NULL REFERENCES nasa_experiment(experiment_key),
    problem_code     TEXT NOT NULL REFERENCES cv_problem(problem_code),
    metric_code      TEXT REFERENCES metric(metric_code),
    finding_text     TEXT NOT NULL,
    is_quantitative  BOOLEAN NOT NULL,
    species          TEXT
);
CREATE INDEX ix_evidence_problem ON nasa_evidence_finding (problem_code);

-- ════════════════════ Vistas para el backend ═════════════════════════════
CREATE VIEW v_study_3d_mean AS                   -- eco 3D: promedio de analistas por sujeto, momento y métrica
SELECT subject_code, timepoint_code, metric_code, AVG(value) AS value, COUNT(value) AS n_reads
FROM study_echo_measurement
WHERE method IN ('3D', 'DERIVED') AND value IS NOT NULL
GROUP BY subject_code, timepoint_code, metric_code;

CREATE VIEW v_problem_evidence AS
SELECT e.problem_code, p.name_es AS problem_name, e.metric_code, e.finding_text, e.is_quantitative, e.species,
       x.experiment_id, x.title AS experiment_title
FROM nasa_evidence_finding e
JOIN nasa_experiment x ON x.experiment_key = e.experiment_key
JOIN cv_problem p ON p.problem_code = e.problem_code;

CREATE VIEW v_latest_vitals AS                   -- último valor de cada signo vital por tripulante
SELECT m.crew_code, m.metric_code, m.value, m.status, m.ts
FROM measurement m
JOIN (SELECT crew_code, metric_code, MAX(ts) AS ts FROM measurement WHERE crew_code IS NOT NULL
      GROUP BY crew_code, metric_code) last
  ON last.crew_code = m.crew_code AND last.metric_code = m.metric_code AND last.ts = m.ts;
