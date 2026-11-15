-- Consultas de ejemplo sobre data/health_monitor.sqlite (SQL estándar, válido en SQLite y PostgreSQL)
-- Las estadísticas avanzadas (IC 95 %, pruebas, correlaciones, fenotipos) las calcula el backend: /api/analytics/*

-- 1. PROBLEMAS: problemas cardiovasculares del vuelo espacial con sus contramedidas
SELECT p.severity_rank, p.name_es AS problema, pc.role, c.name_es AS contramedida
FROM cv_problem p
JOIN problem_countermeasure pc ON pc.problem_code = p.problem_code
JOIN countermeasure c ON c.countermeasure_code = pc.countermeasure_code
ORDER BY p.severity_rank, pc.role;

-- 2. ESTUDIO CFT70: cambio medio (%) vs antes del reposo, por grupo, al día 70
--    (primero se promedian los analistas del eco 3D de cada sujeto, luego se promedia el % de cada sujeto)
WITH v AS (
  SELECT subject_code, timepoint_code, metric_code, AVG(value) AS value
  FROM study_echo_measurement WHERE value IS NOT NULL
  GROUP BY subject_code, timepoint_code, metric_code
)
SELECT s.group_code, b.metric_code, COUNT(*) AS n,
       ROUND(AVG((d.value - b.value) * 100.0 / b.value), 1) AS pct_change
FROM v b
JOIN v d ON d.subject_code = b.subject_code AND d.metric_code = b.metric_code AND d.timepoint_code = 'BR70'
JOIN study_subject s ON s.subject_code = b.subject_code
WHERE b.timepoint_code = 'BR-2' AND b.value <> 0 AND s.group_code <> 'UNASSIGNED'
  AND b.metric_code IN ('lv_mass', 'stroke_volume', 'lvot_vti', 'hr_tdi_left', 'cardiac_output', 'e_a_ratio')
GROUP BY s.group_code, b.metric_code
ORDER BY b.metric_code, s.group_code;

-- 3. SUJETO: tabla de ecocardiografía de un sujeto (todas las sesiones, eco 3D promediado)
SELECT t.short_label, e.metric_code, ROUND(AVG(e.value), 2) AS value
FROM study_echo_measurement e
JOIN study_timepoint t ON t.timepoint_code = e.timepoint_code
WHERE e.subject_code = 'S6546' AND e.value IS NOT NULL
  AND e.metric_code IN ('lv_mass', 'lvedv', 'stroke_volume', 'lvef', 'cardiac_output', 'hr_tdi_left', 'lvot_vti', 'tei_index')
GROUP BY t.sort_order, t.short_label, e.metric_code
ORDER BY e.metric_code, t.sort_order;

-- 4. MÉTRICAS DERIVADAS: fórmula usada y cuántos valores hay de cada una
SELECT metric_code, comment AS formula, COUNT(*) AS n, ROUND(MIN(value), 2) AS min, ROUND(MAX(value), 2) AS max
FROM study_echo_measurement
WHERE source_file = 'derived'
GROUP BY metric_code, comment;

-- 5. CONFIABILIDAD: lecturas del mismo eco 3D por los analistas A2 y A3 (base del cambio mínimo detectable)
SELECT a.metric_code, COUNT(*) AS pares,
       ROUND(AVG(a.value - b.value), 2) AS sesgo_medio,
       ROUND(AVG(ABS(a.value - b.value)), 2) AS diferencia_absoluta_media
FROM study_echo_measurement a
JOIN study_echo_measurement b ON b.subject_code = a.subject_code AND b.timepoint_code = a.timepoint_code
 AND b.metric_code = a.metric_code AND b.analyzer_code = 'A3'
WHERE a.analyzer_code = 'A2' AND a.value IS NOT NULL AND b.value IS NOT NULL
  AND a.metric_code IN ('lv_mass', 'lvedv', 'lvesv', 'stroke_volume')
GROUP BY a.metric_code;

-- 6. PREVENCIÓN: reglas de alerta con su acción recomendada y la contramedida
SELECT r.metric_code, r.level, r.condition_es, r.action_es, c.name_es AS contramedida
FROM alert_rule r
LEFT JOIN countermeasure c ON c.countermeasure_code = r.countermeasure_code
WHERE r.metric_code IN (SELECT metric_code FROM region_metric)
ORDER BY r.metric_code, CASE r.level WHEN 'critical' THEN 0 ELSE 1 END;

-- 7. PUNTAJE: regiones del corazón y métricas que las componen
SELECT cr.sort_order, cr.name_es AS region, cr.weight AS peso_region, m.name_es AS metrica, rm.weight AS peso_metrica
FROM cardiac_region cr
JOIN region_metric rm ON rm.region_code = cr.region_code
JOIN metric m ON m.metric_code = rm.metric_code
ORDER BY cr.sort_order, rm.weight DESC;

-- 8. EVIDENCIA: hallazgos NASA que respaldan un problema
SELECT experiment_id, experiment_title, finding_text
FROM v_problem_evidence
WHERE problem_code = 'ORTHOSTATIC_INTOLERANCE' AND is_quantitative
LIMIT 5;
