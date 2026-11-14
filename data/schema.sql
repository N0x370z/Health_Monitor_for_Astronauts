-- Health Monitor for Astronauts — esquema normalizado (3FN)
-- SQL portable: funciona en PostgreSQL y en SQLite (data/scripts/build_db.py).
-- Orden de carga = orden de este archivo (respeta llaves foráneas).

-- ════════════════════ 1. Referencia médica (corazón) ════════════════════
CREATE TABLE risk_domain (
    domain_code     TEXT PRIMARY KEY,           -- RAD, ISO, DIST, GRAV, ENV (5 riesgos NASA)
    name_es         TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    description_es  TEXT
);

CREATE TABLE source (
    source_id    TEXT PRIMARY KEY,
    source_type  TEXT NOT NULL,                 -- clinical_guideline, peer_reviewed, nasa_lsda, project_heuristic, ...
    citation     TEXT NOT NULL,
    url          TEXT,
    notes        TEXT
);

CREATE TABLE metric (
    metric_code     TEXT PRIMARY KEY,
    name_es         TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    unit            TEXT NOT NULL,
    domain_code     TEXT NOT NULL REFERENCES risk_domain(domain_code),
    body_system     TEXT NOT NULL,
    scope           TEXT NOT NULL CHECK (scope IN ('crew', 'environment')),
    sampling        TEXT NOT NULL,              -- 5min, daily, weekly, monthly, event, mission
    description_es  TEXT
);

-- Rangos por métrica y contexto. Estado:
--   critical si value <= critical_low o value >= critical_high
--   warning  si value <  normal_min   o value >  normal_max
CREATE TABLE medical_reference (
    reference_id                    TEXT PRIMARY KEY,
    metric_code                     TEXT NOT NULL REFERENCES metric(metric_code),
    context                         TEXT NOT NULL,   -- any, exercise, leo, mars_transit, crew_cabin, ...
    normal_min                      REAL,
    normal_max                      REAL,
    critical_low                    REAL,
    critical_high                   REAL,
    expected_value                  REAL,
    expected_spaceflight_effect_es  TEXT,
    clinical_note_es                TEXT,
    primary_source_id               TEXT NOT NULL REFERENCES source(source_id),
    evidence_source_id              TEXT REFERENCES source(source_id),
    confidence                      TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'needs_verification')),
    UNIQUE (metric_code, context)
);

-- ════════════════════ 2. Misiones y tripulación (sintéticas, anónimas) ════
CREATE TABLE mission (
    mission_code            TEXT PRIMARY KEY,
    name_es                 TEXT NOT NULL,
    environment_context     TEXT NOT NULL,
    gravity_g               REAL NOT NULL,
    earth_distance_km       REAL,
    comm_delay_one_way_s    REAL,
    resupply_interval_days  INTEGER,             -- NULL = sin reabastecimiento
    evacuation_time_days    INTEGER,             -- NULL = sin evacuación posible
    duration_days           INTEGER NOT NULL,
    current_mission_day     INTEGER NOT NULL,
    description_es          TEXT
);

CREATE TABLE crew_member (                       -- sin nombre, edad ni datos personales
    crew_code              TEXT PRIMARY KEY,
    mission_code           TEXT NOT NULL REFERENCES mission(mission_code),
    role                   TEXT NOT NULL,
    baseline_hr            REAL,
    baseline_sbp           REAL,
    baseline_dbp           REAL,
    baseline_temp          REAL,
    baseline_resp          REAL,
    prior_career_dose_msv  REAL
);

CREATE TABLE event (                             -- anomalías inyectadas (verdad de referencia)
    event_id            TEXT PRIMARY KEY,
    mission_code        TEXT REFERENCES mission(mission_code),     -- NULL = todas las misiones
    crew_code           TEXT REFERENCES crew_member(crew_code),    -- NULL = módulo/ambiente
    event_type          TEXT NOT NULL,
    domain_code         TEXT NOT NULL REFERENCES risk_domain(domain_code),
    scale               TEXT NOT NULL CHECK (scale IN ('24h', 'daily')),
    start_ts            TEXT,
    end_ts              TEXT,
    metrics             TEXT NOT NULL,          -- lista separada por ';' (solo descriptiva)
    description_es      TEXT,
    evidence_source_id  TEXT REFERENCES source(source_id)
);

CREATE TABLE measurement (                       -- últimas 24 h, cada 5 min
    measurement_id       INTEGER PRIMARY KEY,
    ts                   TEXT NOT NULL,          -- ISO 8601 UTC
    mission_code         TEXT NOT NULL REFERENCES mission(mission_code),
    crew_code            TEXT REFERENCES crew_member(crew_code),   -- NULL = sensor del módulo
    metric_code          TEXT NOT NULL REFERENCES metric(metric_code),
    value                REAL NOT NULL,
    activity             TEXT NOT NULL CHECK (activity IN ('sleep', 'work', 'exercise')),
    status               TEXT NOT NULL CHECK (status IN ('normal', 'warning', 'critical', 'unknown')),
    is_injected_anomaly  BOOLEAN NOT NULL,
    event_id             TEXT REFERENCES event(event_id)
);
CREATE INDEX ix_measurement_metric_ts ON measurement (metric_code, ts);
CREATE INDEX ix_measurement_crew_ts ON measurement (crew_code, ts);
CREATE INDEX ix_measurement_status ON measurement (status);

CREATE TABLE daily_measurement (                 -- historial de misión (diario/semanal/mensual)
    daily_id             INTEGER PRIMARY KEY,
    date                 TEXT NOT NULL,
    mission_day          INTEGER NOT NULL,
    mission_code         TEXT NOT NULL REFERENCES mission(mission_code),
    crew_code            TEXT NOT NULL REFERENCES crew_member(crew_code),
    metric_code          TEXT NOT NULL REFERENCES metric(metric_code),
    value                REAL NOT NULL,
    status               TEXT NOT NULL CHECK (status IN ('normal', 'warning', 'critical', 'unknown')),
    is_injected_anomaly  BOOLEAN NOT NULL,
    event_id             TEXT REFERENCES event(event_id)
);
CREATE INDEX ix_daily_metric_date ON daily_measurement (metric_code, date);
CREATE INDEX ix_daily_crew_date ON daily_measurement (crew_code, date);

-- ════════════════════ 3. Evidencia NASA LSDA (datos reales, públicos) ══════
CREATE TABLE nasa_topic (
    topic_code   TEXT PRIMARY KEY,
    name_es      TEXT NOT NULL,
    domain_code  TEXT NOT NULL REFERENCES risk_domain(domain_code)
);

CREATE TABLE nasa_experiment (
    experiment_key  TEXT PRIMARY KEY,           -- id interno NLSP
    experiment_id   TEXT,
    title           TEXT,
    program         TEXT,
    species         TEXT,
    research_area   TEXT,
    archive_status  TEXT,
    objectives      TEXT,
    approach        TEXT,
    results         TEXT,
    results_source  TEXT,
    has_results     BOOLEAN NOT NULL
);

CREATE TABLE nasa_dataset (
    dataset_id           TEXT PRIMARY KEY,      -- id NLSP (de nlsp_url)
    name                 TEXT NOT NULL,
    species              TEXT,
    experiment_type      TEXT,
    processing_level     TEXT,
    availability         TEXT,
    file_name            TEXT,
    file_format          TEXT,
    file_size            TEXT,
    release_date         TEXT,
    parameters           TEXT,
    description          TEXT,
    nlsp_url             TEXT NOT NULL,
    is_public            BOOLEAN NOT NULL,      -- descargable sin solicitud formal
    is_aggregated        BOOLEAN NOT NULL,      -- resumido/analizado (sin filas por persona)
    is_machine_readable  BOOLEAN NOT NULL       -- xls/csv/txt (no imagen escaneada)
);

CREATE TABLE nasa_dataset_topic (
    dataset_id  TEXT NOT NULL REFERENCES nasa_dataset(dataset_id),
    topic_code  TEXT NOT NULL REFERENCES nasa_topic(topic_code),
    PRIMARY KEY (dataset_id, topic_code)
);

CREATE TABLE nasa_dataset_mission (
    dataset_id    TEXT NOT NULL REFERENCES nasa_dataset(dataset_id),
    mission_name  TEXT NOT NULL,                -- misión histórica (STS-40, Mir 18, ...)
    PRIMARY KEY (dataset_id, mission_name)
);

CREATE TABLE nasa_dataset_experiment (
    dataset_id      TEXT NOT NULL REFERENCES nasa_dataset(dataset_id),
    experiment_key  TEXT NOT NULL REFERENCES nasa_experiment(experiment_key),
    PRIMARY KEY (dataset_id, experiment_key)
);

CREATE TABLE nasa_evidence_finding (            -- oraciones de RESULTS clasificadas
    finding_id       TEXT PRIMARY KEY,
    experiment_key   TEXT NOT NULL REFERENCES nasa_experiment(experiment_key),
    domain_code      TEXT NOT NULL REFERENCES risk_domain(domain_code),
    theme_es         TEXT NOT NULL,
    metric_code      TEXT REFERENCES metric(metric_code),
    finding_text     TEXT NOT NULL,
    is_quantitative  BOOLEAN NOT NULL,
    species          TEXT,
    evidence_kind    TEXT
);
CREATE INDEX ix_evidence_metric ON nasa_evidence_finding (metric_code);
CREATE INDEX ix_evidence_domain ON nasa_evidence_finding (domain_code);

CREATE TABLE nasa_dataset_metric_link (         -- datasets reales útiles para cada métrica del monitor
    dataset_id        TEXT NOT NULL REFERENCES nasa_dataset(dataset_id),
    metric_code       TEXT NOT NULL REFERENCES metric(metric_code),
    use_es            TEXT,
    machine_readable  BOOLEAN NOT NULL,
    PRIMARY KEY (dataset_id, metric_code)
);

-- ════════════════════ 4. Vistas para el backend ══════════════════════════
CREATE VIEW v_alerts_24h AS
SELECT m.ts, m.mission_code, m.crew_code, m.metric_code, mt.name_es AS metric_name, mt.unit,
       mt.domain_code, m.value, m.status, m.activity, m.event_id
FROM measurement m
JOIN metric mt ON mt.metric_code = m.metric_code
WHERE m.status IN ('warning', 'critical');

CREATE VIEW v_metric_evidence AS
SELECT e.metric_code, e.domain_code, e.finding_text, e.is_quantitative, e.species,
       x.experiment_id, x.title AS experiment_title
FROM nasa_evidence_finding e
JOIN nasa_experiment x ON x.experiment_key = e.experiment_key
WHERE e.metric_code IS NOT NULL;
