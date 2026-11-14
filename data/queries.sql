-- Consultas de ejemplo sobre data/health_monitor.sqlite (SQL estándar, válido en SQLite y PostgreSQL)

-- 1. PROBLEMAS: problemas cardiovasculares del vuelo espacial con sus contramedidas
SELECT p.severity_rank, p.name_es AS problema, pc.role, c.name_es AS contramedida
FROM cv_problem p
JOIN problem_countermeasure pc ON pc.problem_code = p.problem_code
JOIN countermeasure c ON c.countermeasure_code = pc.countermeasure_code
ORDER BY p.severity_rank, pc.role;

-- 2. ESTUDIO CFT70: cambio medio vs antes del reposo, Control vs ejercicio, al día 70
SELECT e.metric_code, e.group_code, e.n, ROUND(e.mean_pct_change, 1) AS pct_change
FROM study_effect e
WHERE e.timepoint_code = 'BR70'
  AND e.metric_code IN ('lv_mass', 'stroke_volume', 'lvot_vti', 'hr_tdi_left', 'e_a_ratio', 'lvef')
  AND e.group_code <> 'UNASSIGNED'
ORDER BY e.metric_code, e.group_code;

-- 3. ESTUDIO CFT70: trayectoria de la masa del VI por grupo (todos los momentos)
SELECT t.sort_order, e.timepoint_code, e.group_code, ROUND(e.mean_pct_change, 1) AS pct_change
FROM study_effect e
JOIN study_timepoint t ON t.timepoint_code = e.timepoint_code
WHERE e.metric_code = 'lv_mass' AND e.group_code <> 'UNASSIGNED'
ORDER BY e.group_code, t.sort_order;

-- 4. MONITOREO: últimos signos vitales de cada tripulante
SELECT crew_code, metric_code, value, status, ts
FROM v_latest_vitals
ORDER BY crew_code, metric_code;

-- 5. MONITOREO: palpitaciones (FC fuera de rango en reposo) en las últimas 24 h
SELECT crew_code, MIN(ts) AS first_ts, MAX(ts) AS last_ts, COUNT(*) AS points, MAX(value) AS max_bpm
FROM measurement
WHERE metric_code = 'heart_rate' AND activity <> 'exercise' AND status <> 'normal'
GROUP BY crew_code
ORDER BY max_bpm DESC;

-- 6. MONITOREO: último ecocardiograma de cada tripulante comparado con su línea base
SELECT d.crew_code, d.metric_code, d.value, d.pct_change_from_baseline, d.status
FROM daily_measurement d
JOIN (SELECT crew_code, metric_code, MAX(mission_day) AS last_day FROM daily_measurement
      WHERE metric_code IN ('lv_mass', 'stroke_volume', 'lvot_vti', 'e_a_ratio') GROUP BY 1, 2) l
  ON l.crew_code = d.crew_code AND l.metric_code = d.metric_code AND l.last_day = d.mission_day
ORDER BY d.crew_code, d.metric_code;

-- 7. PREVENCIÓN: reglas que se activan con el estado actual y la acción recomendada
SELECT d.crew_code, r.level, r.condition_es, r.action_es, c.name_es AS contramedida
FROM daily_measurement d
JOIN (SELECT crew_code, metric_code, MAX(mission_day) AS last_day FROM daily_measurement GROUP BY 1, 2) l
  ON l.crew_code = d.crew_code AND l.metric_code = d.metric_code AND l.last_day = d.mission_day
JOIN alert_rule r ON r.metric_code = d.metric_code AND r.level = d.status
LEFT JOIN countermeasure c ON c.countermeasure_code = r.countermeasure_code
ORDER BY CASE r.level WHEN 'critical' THEN 0 ELSE 1 END, d.crew_code;

-- 8. EVIDENCIA: hallazgos NASA que respaldan un problema
SELECT experiment_id, experiment_title, finding_text
FROM v_problem_evidence
WHERE problem_code = 'ORTHOSTATIC_INTOLERANCE' AND is_quantitative
LIMIT 5;
