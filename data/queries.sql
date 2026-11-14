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

-- 2. RADIACIÓN: dosis de carrera actual por tripulante vs límite de 600 mSv
SELECT d.crew_code, d.value AS career_msv, ROUND(100.0 * d.value / 600, 1) AS pct_of_limit, d.status
FROM daily_measurement d
JOIN mission m ON m.mission_code = d.mission_code
WHERE d.metric_code = 'radiation_dose_career' AND d.mission_day = m.current_mission_day
ORDER BY career_msv DESC;

-- 3. CARDIOVASCULAR: episodios de FC fuera de rango en reposo (palpitaciones, excluye ejercicio)
SELECT crew_code, MIN(ts) AS first_ts, MAX(ts) AS last_ts, COUNT(*) AS points, MAX(value) AS max_bpm,
       CASE MAX(CASE status WHEN 'critical' THEN 2 WHEN 'warning' THEN 1 ELSE 0 END)
            WHEN 2 THEN 'critical' WHEN 1 THEN 'warning' ELSE 'normal' END AS worst_status
FROM measurement
WHERE metric_code = 'heart_rate' AND activity <> 'exercise' AND status <> 'normal'
GROUP BY crew_code
ORDER BY max_bpm DESC;

-- 4. CARDIOVASCULAR: presión arterial media diaria fuera de rango (últimos 10 días)
SELECT d.crew_code, d.mission_day, d.metric_code, d.value, d.status
FROM daily_measurement d
JOIN mission m ON m.mission_code = d.mission_code
WHERE d.metric_code IN ('systolic_bp', 'diastolic_bp') AND d.status <> 'normal'
  AND d.mission_day > m.current_mission_day - 10
ORDER BY d.crew_code, d.mission_day;

-- 5. TEMPERATURA y SpO2: puntos fuera de rango en las últimas 24 h
SELECT COALESCE(crew_code, mission_code || ' (cabina)') AS subject, metric_code,
       COUNT(*) AS points, MIN(value) AS min_value, MAX(value) AS max_value
FROM measurement
WHERE metric_code IN ('body_temp', 'cabin_temp', 'spo2') AND status <> 'normal'
GROUP BY 1, 2
ORDER BY 1;

-- 6. PRESIÓN DE CABINA: caída máxima por misión (fugas)
SELECT mission_code, MIN(value) AS min_kpa, MAX(value) AS max_kpa,
       SUM(CASE WHEN status <> 'normal' THEN 1 ELSE 0 END) AS alert_points
FROM measurement
WHERE metric_code = 'cabin_pressure'
GROUP BY mission_code;

-- 7. Rango de referencia + fuente para una métrica (lo que el dashboard muestra junto a la alerta)
SELECT r.metric_code, r.context, r.normal_min, r.normal_max, r.critical_low, r.critical_high,
       r.confidence, s.citation
FROM medical_reference r
JOIN source s ON s.source_id = r.primary_source_id
WHERE r.metric_code = 'heart_rate';

-- 8. Evidencia NASA real para respaldar una alerta
SELECT DISTINCT experiment_id, experiment_title, finding_text
FROM v_metric_evidence
WHERE metric_code = 'hr_orthostatic_increase' AND is_quantitative
LIMIT 5;

-- 9. Evaluar un detector: ¿cuántos puntos de cada evento inyectado quedaron como alerta?
SELECT e.event_id, e.event_type, x.metric_code,
       SUM(CASE WHEN x.status <> 'normal' THEN 1 ELSE 0 END) AS flagged, COUNT(*) AS total
FROM event e
JOIN (SELECT event_id, metric_code, status FROM measurement
      UNION ALL SELECT event_id, metric_code, status FROM daily_measurement) x ON x.event_id = e.event_id
GROUP BY e.event_id, e.event_type, x.metric_code
ORDER BY e.event_id;
