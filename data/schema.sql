-- Health Monitor for Astronauts — esquema de la base de datos cardiovascular (3FN)
-- Archivo: data/health_monitor.sqlite (SQLite). SQL portable a PostgreSQL.
--
-- Solo datos reales y conocimiento con fuente (v4: se eliminó la tripulación sintética).
-- Grupos de tablas:
--   1. Conocimiento: problemas cardiovasculares del vuelo espacial, métricas, rangos, reglas de alerta,
--      contramedidas y fuentes.
--   2. Estudio real NASA CFT70 / BRSMCF: ecocardiografía de 37 sujetos en 70 días de reposo en cama,
--      más métricas derivadas con fórmulas clínicas (method = 'DERIVED').
--   3. Puntaje cardiaco: regiones del corazón y métricas que las componen.
--   4. Evidencia NASA LSDA: catálogo público relacionado con la función cardiovascular.
-- Los resúmenes estadísticos (efectos por grupo, IC 95 %, pruebas, correlaciones, fenotipos) los calcula
-- el backend al arrancar; no se guardan en la base.

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
    raw_labels      TEXT NOT NULL,               -- etiquetas originales en los CSV
    short_label     TEXT                         -- Pre, D7, D21, D30, D70, R+0, R+3 (las usa el frontend)
);

CREATE TABLE study_echo_measurement (            -- formato largo: una fila por sujeto, momento, métrica y analista
    measurement_id   INTEGER PRIMARY KEY,
    subject_code     TEXT NOT NULL REFERENCES study_subject(subject_code),
    timepoint_code   TEXT NOT NULL REFERENCES study_timepoint(timepoint_code),
    metric_code      TEXT NOT NULL REFERENCES metric(metric_code),
    value            REAL,                       -- NULL = no disponible (ver quality_flag)
    method           TEXT NOT NULL CHECK (method IN ('2D_DOPPLER_TDI', '3D', 'DERIVED')),
    analyzer_code    TEXT,                       -- analista anónimo del eco 3D (A1, A2, A3); los derivados del 3D lo conservan
    quality_flag     TEXT NOT NULL CHECK (quality_flag IN ('ok', 'missing', 'bad_image', 'not_analyzable', 'dismissed', 'zero_as_missing')),
    comment          TEXT,                       -- en los derivados: la fórmula usada
    source_file      TEXT NOT NULL               -- CSV de origen, o 'derived'
);
CREATE INDEX ix_study_echo ON study_echo_measurement (metric_code, timepoint_code);
CREATE INDEX ix_study_echo_subject ON study_echo_measurement (subject_code);

-- ════════════════════ 3. Puntaje cardiaco ════════════════════════════════
CREATE TABLE cardiac_region (                    -- regiones del corazón que muestra el frontend
    region_code     TEXT PRIMARY KEY,           -- left_ventricle, aortic_outflow, rate_timing, mitral_valve, right_ventricle
    name_es         TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    description_es  TEXT NOT NULL,
    weight          REAL NOT NULL,              -- peso en el puntaje global (suman 1)
    sort_order      INTEGER NOT NULL
);

CREATE TABLE region_metric (
    region_code     TEXT NOT NULL REFERENCES cardiac_region(region_code),
    metric_code     TEXT NOT NULL REFERENCES metric(metric_code),
    weight          REAL NOT NULL,              -- peso dentro de la región; 0 = solo informativa
    PRIMARY KEY (region_code, metric_code)
);

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

-- ── Bone densitometry (v5): NASA MR035G DXA — UTMB bed rest campaigns, AG pilot and MEDES ──
CREATE TABLE bone_campaign (
    campaign_code   TEXT PRIMARY KEY,            -- UTMB_C3, MEDES, UTMB_C1, UTMB_AG_PILOT
    title           TEXT NOT NULL,
    design          TEXT NOT NULL,
    has_phases      BOOLEAN NOT NULL,            -- 1 = the files label scans PRE / IN / POST bed rest
    source_id       TEXT NOT NULL REFERENCES source(source_id),
    data_source_id  TEXT NOT NULL REFERENCES source(source_id)
);
CREATE TABLE bone_subject (                      -- anonymous NASA codes; no names, birth dates or ethnicity
    subject_code    TEXT PRIMARY KEY,            -- <campaign prefix>-<NASA subject id>, e.g. C3-224
    campaign_code   TEXT NOT NULL REFERENCES bone_campaign(campaign_code),
    cohort          TEXT,                        -- Campaign 3 cohort (C3A ... C3H)
    sex             TEXT CHECK (sex IN ('M', 'F')),
    height_cm       REAL,                        -- at the first scan
    weight_kg       REAL                         -- at the first scan
);
CREATE TABLE bone_region (                       -- skeletal regions kept, and how relevant each is for bone loss
    region_code         TEXT PRIMARY KEY,
    site                TEXT NOT NULL,           -- hip, spine, heel, forearm, whole_body
    name                TEXT NOT NULL,
    weight_bearing      BOOLEAN NOT NULL,
    role                TEXT NOT NULL CHECK (role IN ('key', 'supporting', 'control')),
    rationale           TEXT NOT NULL,           -- why: result in the data + literature
    source_id           TEXT NOT NULL REFERENCES source(source_id),
    sort_order          INTEGER NOT NULL,
    precision_cv_pct    REAL,                    -- RMS-SD of repeated PRE scans / mean (Glüer 1995)
    lsc_pct             REAL,                    -- least significant change, 95 % = 2.77 × CV (ISCD)
    n_precision_visits  INTEGER NOT NULL         -- PRE visits with ≥ 2 repeated scans used for the precision
);
CREATE TABLE bone_parameter (                    -- parameters kept and how to read them
    parameter       TEXT PRIMARY KEY,            -- bmd, z_score, t_score, bmc
    name            TEXT NOT NULL,
    unit            TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('primary', 'supporting')),
    interpretation  TEXT NOT NULL,
    source_id       TEXT NOT NULL REFERENCES source(source_id)
);
CREATE TABLE bone_measurement (                  -- long format: one row per scan, region, side and parameter
    measurement_id        INTEGER PRIMARY KEY,
    subject_code          TEXT NOT NULL REFERENCES bone_subject(subject_code),
    region_code           TEXT NOT NULL REFERENCES bone_region(region_code),
    side                  TEXT CHECK (side IN ('L', 'R')),
    visit_code            TEXT NOT NULL,         -- PRE, BR_MID, BR_END, R+n, FU_6MO, FU_1Y, FOLLOW_UP; V1, V2… when the files have no phase
    phase                 TEXT NOT NULL CHECK (phase IN ('PRE_TEST', 'IN_TEST', 'POST_TEST', 'FOLLOW_UP', 'UNKNOWN')),
    phase_day             INTEGER,               -- BR_DAY as written in the files (days before / into / after bed rest)
    days_from_first_scan  INTEGER,               -- relative day; absolute dates are not stored
    scan_index            INTEGER NOT NULL,      -- repeated scan within the same visit (1, 2, 3)
    parameter             TEXT NOT NULL REFERENCES bone_parameter(parameter),
    value                 REAL NOT NULL,         -- bmd g/cm², bmc g, scores in SD units
    quality_flag          TEXT NOT NULL CHECK (quality_flag IN ('ok', 'scanner_corrected')),
    source_file           TEXT NOT NULL
);
CREATE INDEX ix_bone_measurement ON bone_measurement (region_code, parameter, visit_code);
CREATE INDEX ix_bone_measurement_subject ON bone_measurement (subject_code);
-- Mean of the repeated scans of each visit (what the analysis uses).
CREATE VIEW v_bone_visit AS
SELECT subject_code, region_code, side, visit_code, phase, parameter,
       AVG(value) AS value, COUNT(*) AS n_scans, MIN(days_from_first_scan) AS days_from_first_scan
FROM bone_measurement
GROUP BY subject_code, region_code, side, visit_code, phase, parameter;
