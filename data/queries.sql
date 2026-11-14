-- Consultas de ejemplo (probadas en SQLite, SQL estándar válido en PostgreSQL)

-- 1. RADIACIÓN: tasa de dosis y picos de las últimas 24 h por misión
SELECT mission_code,
       ROUND(AVG(CASE WHEN metric_code = 'radiation_dose_rate' THEN value END), 3) AS avg_msv_day,
       MAX(CASE WHEN metric_code = 'radiation_dose_rate' THEN value END)           AS peak_msv_day,
       MAX(CASE WHEN metric_code = 'dose_rate_spike_ratio' THEN value END)         AS peak_ratio,
       SUM(CASE WHEN metric_code = 'dose_rate_spike_ratio' AND status = 'critical' THEN 1 ELSE 0 END) AS critical_points
FROM measurement
WHERE metric_code IN ('radiation_dose_rate', 'dose_rate_spike_ratio')
GROUP BY mission_code;

-- 2. PALPITACIONES: episodios de FC fuera de rango en reposo (excluye ejercicio)
SELECT crew_code, MIN(ts) AS first_ts, MAX(ts) AS last_ts, COUNT(*) AS points, MAX(value) AS max_bpm,
       CASE MAX(CASE status WHEN 'critical' THEN 2 WHEN 'warning' THEN 1 ELSE 0 END)
            WHEN 2 THEN 'critical' WHEN 1 THEN 'warning' ELSE 'normal' END AS worst_status
FROM measurement
WHERE metric_code = 'heart_rate' AND activity <> 'exercise' AND status <> 'normal'
GROUP BY crew_code
ORDER BY max_bpm DESC;

-- 3. SUEÑO: promedio de los últimos 14 días por tripulante vs recomendación (>=7 h)
SELECT d.crew_code, ROUND(AVG(d.value), 2) AS avg_sleep_h,
       SUM(CASE WHEN d.status <> 'normal' THEN 1 ELSE 0 END) AS nights_below_reference
FROM daily_measurement d
JOIN mission m ON m.mission_code = d.mission_code
WHERE d.metric_code = 'sleep_duration' AND d.mission_day > m.current_mission_day - 14
GROUP BY d.crew_code
ORDER BY avg_sleep_h;

-- 4. Rango de referencia + fuente para una métrica (lo que el dashboard muestra junto a la alerta)
SELECT r.metric_code, r.context, r.normal_min, r.normal_max, r.critical_low, r.critical_high,
       r.confidence, s.citation
FROM medical_reference r
JOIN source s ON s.source_id = r.primary_source_id
WHERE r.metric_code = 'heart_rate';

-- 5. Evidencia NASA real para respaldar una alerta (p. ej. pérdida ósea)
SELECT DISTINCT experiment_id, experiment_title, finding_text
FROM v_metric_evidence
WHERE metric_code = 'bmd_change_pct_month' AND is_quantitative
LIMIT 5;

-- 6. Alertas activas de las últimas 24 h por dominio de riesgo (RAD/ISO/DIST/GRAV/ENV)
SELECT domain_code, status, COUNT(*) AS n
FROM v_alerts_24h
GROUP BY domain_code, status
ORDER BY domain_code, status;

-- 7. Evaluar un detector: ¿cuántos puntos de cada evento inyectado quedaron como alerta?
SELECT e.event_id, e.event_type, m.metric_code,
       SUM(CASE WHEN m.status <> 'normal' THEN 1 ELSE 0 END) AS flagged, COUNT(*) AS total
FROM measurement m
JOIN event e ON e.event_id = m.event_id
GROUP BY e.event_id, e.event_type, m.metric_code
ORDER BY e.event_id;

-- 8. Datasets NASA reales (públicos y legibles por máquina) útiles para una métrica
SELECT d.name, d.file_name, d.nlsp_url
FROM nasa_dataset_metric_link l
JOIN nasa_dataset d ON d.dataset_id = l.dataset_id
WHERE l.metric_code = 'radiation_dose_rate' AND d.is_public AND d.is_machine_readable;
