import { all } from '../db.js';
import { shiftDate, shiftTs, windowStart } from './time.js';

// Lógica de prevención: convierte el estado de las mediciones en alertas con acción recomendada.
//   - Signos vitales (24 h): crítico si hay un punto crítico en los últimos 60 min fuera de ejercicio;
//     warning si hay 3 o más puntos fuera de rango en esa ventana (evita alertas por un solo valor).
//   - Historial (eco, ortostatismo, PA media, ejercicio, dosis): estado del último registro de cada métrica.
//   - Módulo (radiación): picos en los últimos 60 min, aplican a toda la tripulación de la misión.

const VITALS = ['heart_rate', 'systolic_bp', 'diastolic_bp', 'spo2', 'body_temp'];
const LEVEL = { normal: 0, warning: 1, critical: 2 };
const WINDOW_HOURS = 1;
const SUSTAINED_POINTS = 3;

const rulesByKey = new Map();
for (const r of all(`
    SELECT r.*, c.name_es AS countermeasure_name
    FROM alert_rule r LEFT JOIN countermeasure c USING (countermeasure_code)`)) {
  const key = `${r.metric_code}:${r.level}`;
  if (!rulesByKey.has(key)) rulesByKey.set(key, []);
  rulesByKey.get(key).push(r);
}

const metrics = new Map(all(`
    SELECT m.metric_code, m.name_es, m.unit, m.problem_code, p.name_es AS problem_name, p.severity_rank
    FROM metric m LEFT JOIN cv_problem p USING (problem_code)`).map((m) => [m.metric_code, m]));

function pickRule(metric, level, preferred) {
  const rules = rulesByKey.get(`${metric}:${level}`) ?? [];
  return rules.find((r) => r.condition_type === preferred) ?? rules[0] ?? null;
}

function buildAlert({ crew, mission, metric, level, value, pct, observedAt, source, preferred }) {
  const m = metrics.get(metric);
  const rule = pickRule(metric, level, preferred);
  return {
    crew_code: crew,
    mission_code: mission,
    level,
    source,
    metric_code: metric,
    metric_name: m?.name_es ?? metric,
    unit: m?.unit ?? null,
    value,
    pct_change_from_baseline: pct ?? null,
    observed_at: observedAt,
    problem_code: rule?.problem_code ?? m?.problem_code ?? null,
    problem_name: m?.problem_name ?? null,
    severity_rank: m?.severity_rank ?? 9,
    rule_id: rule?.rule_id ?? null,
    condition: rule?.condition_es ?? 'Valor fuera del rango de referencia',
    action: rule?.action_es ?? 'Repetir la medición y revisar con el cirujano de vuelo si persiste.',
    countermeasure_code: rule?.countermeasure_code ?? 'MEDICAL_CONSULT',
    countermeasure_name: rule?.countermeasure_name ?? 'Consulta con el cirujano de vuelo',
  };
}

function vitalAlerts(crew, mission) {
  const rows = all(
    `SELECT metric_code, ts, value, status FROM measurement
     WHERE crew_code = ? AND ts > ? AND activity <> 'exercise' AND status <> 'normal'
     ORDER BY ts DESC`,
    crew, windowStart(WINDOW_HOURS));
  const out = [];
  for (const metric of VITALS) {
    const points = rows.filter((r) => r.metric_code === metric);
    const critical = points.find((p) => p.status === 'critical');
    const level = critical ? 'critical' : points.length >= SUSTAINED_POINTS ? 'warning' : null;
    if (!level) continue;
    const p = critical ?? points[0];
    out.push(buildAlert({ crew, mission, metric, level, value: p.value, observedAt: shiftTs(p.ts),
      source: 'vitals_24h', preferred: 'absolute' }));
  }
  return out;
}

function historyAlerts(crew, mission) {
  return all(
    `SELECT d.metric_code, d.value, d.pct_change_from_baseline AS pct, d.status, d.date
     FROM daily_measurement d
     JOIN (SELECT metric_code, MAX(mission_day) AS day FROM daily_measurement WHERE crew_code = ? GROUP BY metric_code) l
       ON l.metric_code = d.metric_code AND l.day = d.mission_day
     WHERE d.crew_code = ? AND d.status <> 'normal'`,
    crew, crew,
  ).map((r) => buildAlert({
    crew, mission, metric: r.metric_code, level: r.status, value: r.value, pct: r.pct,
    observedAt: shiftDate(r.date), source: 'history',
    preferred: r.pct != null ? 'change_from_baseline' : r.metric_code === 'systolic_bp' ? 'sustained' : 'absolute',
  }));
}

function moduleAlerts(mission) {
  const rows = all(
    `SELECT ts, value, status FROM measurement
     WHERE mission_code = ? AND crew_code IS NULL AND metric_code = 'dose_rate_spike_ratio' AND ts > ? AND status <> 'normal'
     ORDER BY CASE status WHEN 'critical' THEN 0 ELSE 1 END, ts DESC LIMIT 1`,
    mission, windowStart(WINDOW_HOURS));
  return rows.map((r) => buildAlert({ crew: null, mission, metric: 'dose_rate_spike_ratio', level: r.status,
    value: r.value, observedAt: shiftTs(r.ts), source: 'module', preferred: 'absolute' }));
}

function sortAlerts(list) {
  return list.sort((a, b) => LEVEL[b.level] - LEVEL[a.level] || a.severity_rank - b.severity_rank);
}

/** Alertas activas de un tripulante (incluye las del módulo de su misión). */
export function crewAlerts(crew, mission) {
  return sortAlerts([...vitalAlerts(crew, mission), ...historyAlerts(crew, mission), ...moduleAlerts(mission)]);
}

/**
 * Episodios de las últimas 24 h: tramos consecutivos fuera de rango (fuera de ejercicio).
 * Sirven para ver eventos ya resueltos, como palpitaciones o picos de radiación de hace horas.
 */
export function episodes24h(crew, mission) {
  const rows = all(
    `SELECT crew_code, metric_code, ts, value, status FROM measurement
     WHERE ((crew_code = ? AND activity <> 'exercise') OR (crew_code IS NULL AND mission_code = ? AND metric_code = 'dose_rate_spike_ratio'))
       AND status <> 'normal' AND ts > ?
     ORDER BY metric_code, ts`,
    crew, mission, windowStart(24));
  const out = [];
  for (const r of rows) {
    const last = out.at(-1);
    const t = Date.parse(r.ts);
    if (last && last.metric_code === r.metric_code && t - last._end <= 10 * 60_000) {
      last._end = t;
      last.points += 1;
      if (LEVEL[r.status] > LEVEL[last.level]) last.level = r.status;
      last.peak = Math.abs(r.value - last._ref) > Math.abs(last.peak - last._ref) ? r.value : last.peak;
      continue;
    }
    const m = metrics.get(r.metric_code);
    out.push({ metric_code: r.metric_code, metric_name: m?.name_es ?? r.metric_code, unit: m?.unit ?? null,
      scope: r.crew_code ? 'crew' : 'module', level: r.status, points: 1, peak: r.value,
      _ref: { spo2: 97, body_temp: 36.8, heart_rate: 65, systolic_bp: 118, diastolic_bp: 72 }[r.metric_code] ?? 0,
      _start: t, _end: t });
  }
  return out
    .filter((e) => e.level === 'critical' || e.points >= SUSTAINED_POINTS)
    .map(({ _ref, _start, _end, ...e }) => ({
      ...e,
      start: shiftTs(new Date(_start).toISOString()),
      end: shiftTs(new Date(_end).toISOString()),
      duration_min: Math.round((_end - _start) / 60_000) + 5,
    }))
    .sort((a, b) => Date.parse(b.end) - Date.parse(a.end));
}

/** Resumen de riesgo: nivel global, puntaje 0-100 y nivel por problema cardiovascular. */
export function riskSummary(alerts) {
  const byProblem = {};
  let score = 0;
  for (const a of alerts) {
    const weight = (a.level === 'critical' ? 30 : 10) * (1 + Math.max(0, 5 - a.severity_rank) / 5);
    score += weight;
    if (a.problem_code && LEVEL[a.level] > LEVEL[byProblem[a.problem_code] ?? 'normal']) {
      byProblem[a.problem_code] = a.level;
    }
  }
  const level = alerts.some((a) => a.level === 'critical') ? 'critical' : alerts.length ? 'warning' : 'normal';
  return { level, score: Math.min(100, Math.round(score)), alert_count: alerts.length, by_problem: byProblem };
}

/** Alertas de toda la tripulación (las del módulo se reportan una sola vez por misión). */
export function allAlerts() {
  const crew = all('SELECT crew_code, mission_code FROM crew_member ORDER BY crew_code');
  const missions = [...new Set(crew.map((c) => c.mission_code))];
  const list = [
    ...crew.flatMap((c) => [...vitalAlerts(c.crew_code, c.mission_code), ...historyAlerts(c.crew_code, c.mission_code)]),
    ...missions.flatMap(moduleAlerts),
  ];
  return sortAlerts(list);
}
