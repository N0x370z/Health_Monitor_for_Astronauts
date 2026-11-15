import { all, get } from '../db.js';
import { HttpError } from '../http.js';

// Carga una sola vez el estudio CFT70 y la base de conocimiento. Los datos no cambian mientras
// corre el servidor (la base se abre en solo lectura), así que todo lo demás se calcula en memoria.

export const BASELINE = 'BR-2';
const STATUS_RANK = { normal: 0, warning: 1, critical: 2 };
export const worst = (a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a);
export const STATUS_LABEL = { normal: 'Nominal', warning: 'Atención', critical: 'Crítico' };

export const study = get('SELECT * FROM study WHERE study_code = ?', 'CFT70');

export const timepoints = all('SELECT * FROM study_timepoint ORDER BY sort_order');
const tpByKey = new Map();
for (const t of timepoints) {
  tpByKey.set(t.timepoint_code.toUpperCase(), t);
  tpByKey.set(t.short_label.toUpperCase(), t);
}

export const groups = all('SELECT * FROM study_group ORDER BY group_code');
export const groupByCode = new Map(groups.map((g) => [g.group_code, g]));
export const COMPARISON_GROUPS = groups.filter((g) => g.group_code !== 'UNASSIGNED').map((g) => g.group_code);

export const subjects = all('SELECT * FROM study_subject ORDER BY subject_code');
const subjectByCode = new Map(subjects.map((s) => [s.subject_code, s]));

export const metrics = new Map(all(`
  SELECT m.*, p.name_es AS problem_name, p.severity_rank
  FROM metric m LEFT JOIN cv_problem p USING (problem_code)`).map((m) => [m.metric_code, m]));

export const references = new Map(all(`
  SELECT r.*, s.citation FROM medical_reference r JOIN source s ON s.source_id = r.primary_source_id
  WHERE r.context IN ('any', 'supine_rest')`).map((r) => [r.metric_code, r]));

export const changeThresholds = new Map(all('SELECT * FROM change_threshold').map((t) => [t.metric_code, t]));

export const regions = all('SELECT * FROM cardiac_region ORDER BY sort_order').map((r) => ({
  ...r,
  metrics: all('SELECT metric_code, weight FROM region_metric WHERE region_code = ? ORDER BY weight DESC, metric_code', r.region_code),
}));

export const rules = all(`
  SELECT r.*, c.name_es AS countermeasure_name FROM alert_rule r
  LEFT JOIN countermeasure c USING (countermeasure_code)`);

// ── Valores del eco ──────────────────────────────────────────────────────
// values: sujeto → momento → métrica → valor (promedio de analistas en el eco 3D).
// reads:  sujeto|momento|métrica → { A2: v, A3: v } solo para el eco 3D y sus derivados.
const values = new Map();
const reads = new Map();
const acc = new Map();
for (const r of all(`SELECT subject_code, timepoint_code, metric_code, value, analyzer_code
                     FROM study_echo_measurement WHERE value IS NOT NULL`)) {
  const key = `${r.subject_code}|${r.timepoint_code}|${r.metric_code}`;
  const a = acc.get(key) ?? { sum: 0, n: 0 };
  a.sum += r.value;
  a.n += 1;
  acc.set(key, a);
  if (r.analyzer_code) {
    if (!reads.has(key)) reads.set(key, {});
    reads.get(key)[r.analyzer_code] = r.value;
  }
}
for (const [key, a] of acc) {
  const [s, t, m] = key.split('|');
  if (!values.has(s)) values.set(s, new Map());
  const byTp = values.get(s);
  if (!byTp.has(t)) byTp.set(t, new Map());
  byTp.get(t).set(m, a.sum / a.n);
}

export const value = (subject, tp, metric) => values.get(subject)?.get(tp)?.get(metric) ?? null;

/** Cambio porcentual respecto a la línea base del propio sujeto (BR-2). */
export function pctChange(subject, tp, metric) {
  const b = value(subject, BASELINE, metric);
  const v = value(subject, tp, metric);
  return b == null || v == null || b === 0 ? null : ((v - b) / b) * 100;
}

/** Pares de lecturas A2/A3 de una métrica 3D (mismas imágenes, dos analistas). */
export function analyzerPairs(metric) {
  const out = [];
  for (const [key, r] of reads) {
    if (key.endsWith(`|${metric}`) && r.A2 != null && r.A3 != null) out.push([r.A2, r.A3]);
  }
  return out;
}

export const metricsWithReads = [...new Set([...reads.keys()].map((k) => k.split('|')[2]))];

// ── Resolución de parámetros ─────────────────────────────────────────────
export function findTimepoint(code, fallback = 'BR70') {
  // En una URL "R+0" llega como "R 0" (el + se decodifica como espacio).
  const t = tpByKey.get(String(code ?? fallback).trim().replace(/\s+/g, '+').toUpperCase());
  if (!t) throw new HttpError(400, `Momento no válido: ${code}. Usa ${timepoints.map((x) => x.short_label).join(', ')}`);
  return t;
}

/** Acepta el código de la base (S6546) o el número NASA (6546). */
export function findSubject(code) {
  const raw = String(code).toUpperCase();
  const s = subjectByCode.get(raw) ?? subjectByCode.get(`S${raw}`);
  if (!s) throw new HttpError(404, `Sujeto ${code} no encontrado`);
  return s;
}

export function findMetric(code) {
  const m = metrics.get(code);
  if (!m) throw new HttpError(400, `Métrica no válida: ${code}`);
  return m;
}

export function subjectsInGroup(group) {
  return subjects.filter((s) => s.group_code === group).map((s) => s.subject_code);
}

export function publicSubject(s) {
  const g = groupByCode.get(s.group_code);
  return {
    subject_code: s.subject_code,
    nasa_id: s.subject_code.replace(/^S/, ''),
    group_code: s.group_code,
    group_name: g?.name_es ?? s.group_code,
    is_countermeasure: Boolean(g?.is_countermeasure),
    in_subset_7: Boolean(s.in_subset_7),
    has_2d_echo: Boolean(s.has_2d_echo),
    has_3d_echo: Boolean(s.has_3d_echo),
  };
}

export function publicTimepoint(t) {
  return { timepoint_code: t.timepoint_code, short_label: t.short_label, label_es: t.label_es, phase: t.phase, day_offset: t.day_offset };
}

export function metricInfo(code) {
  const m = metrics.get(code);
  return { metric_code: code, name_es: m?.name_es ?? code, unit: m?.unit ?? null };
}
