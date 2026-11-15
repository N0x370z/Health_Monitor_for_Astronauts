import { bestProtocol, groupEffect, mdcPct, phenotypes, trajectoryAlarm } from './analytics.js';
import {
  BASELINE, STATUS_LABEL, changeThresholds, findTimepoint, groupByCode, metricInfo, metrics, pctChange, references, regions,
  rules, value, worst,
} from './dataset.js';
import { round } from './stats.js';

// Evaluación de un sujeto en un momento del estudio:
//   1. cada métrica contra su rango clínico (medical_reference) y su umbral de cambio (change_threshold);
//   2. un cambio menor al error de medición (MDC95 del eco 3D) baja un nivel;
//   3. las métricas se agrupan en regiones del corazón (cardiac_region) con un puntaje 0-100.

const DOWNGRADE = { critical: 'warning', warning: 'normal', normal: 'normal' };
const SEVERITY_CAP = { normal: 0.29, warning: 0.69, critical: 1 };
const fmt = (x, d = 1) => (x == null ? '—' : Number(x).toFixed(d));
const signed = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)} %`;

/** Gravedad continua 0-1 de un cambio adverso según los umbrales de aviso y crítico. */
function changeSeverity(adverse, warn, crit) {
  if (adverse <= 0) return 0;
  if (adverse < warn) return 0.3 * (adverse / warn);
  if (adverse < crit) return 0.3 + 0.4 * ((adverse - warn) / (crit - warn));
  return Math.min(1, 0.7 + 0.3 * ((adverse - crit) / crit));
}

function absoluteStatus(v, ref) {
  if (!ref) return { status: 'normal' };
  const { normal_min: lo, normal_max: hi, critical_low: cl, critical_high: ch } = ref;
  if ((cl != null && v <= cl) || (ch != null && v >= ch)) {
    return { status: 'critical', reason: `${fmt(v)} fuera del límite crítico (${cl != null && v <= cl ? `≤ ${cl}` : `≥ ${ch}`})` };
  }
  if ((lo != null && v < lo) || (hi != null && v > hi)) {
    return { status: 'warning', reason: `${fmt(v)} fuera del rango normal (${lo ?? '—'} a ${hi ?? '—'})` };
  }
  return { status: 'normal' };
}

/** Estado de una métrica de un sujeto en un momento. Devuelve null si no hay dato. */
export function evaluateMetric(subject, tp, metric) {
  const v = value(subject, tp, metric);
  if (v == null) return null;
  const info = metricInfo(metric);
  const ref = references.get(metric);
  const th = changeThresholds.get(metric);
  const pct = pctChange(subject, tp, metric);
  const reasons = [];

  const abs = absoluteStatus(v, ref);
  if (abs.reason) reasons.push(abs.reason);
  let severity = abs.status === 'critical' ? 1 : abs.status === 'warning' ? 0.5 : 0;

  let change = 'normal';
  let withinError = false;
  const mdc = mdcPct(metric);
  if (th && pct != null && tp !== BASELINE) {
    const adverse = th.direction === 'decrease' ? -pct : pct;
    change = adverse >= th.critical_pct ? 'critical' : adverse >= th.warning_pct ? 'warning' : 'normal';
    let sev = changeSeverity(adverse, th.warning_pct, th.critical_pct);
    if (change !== 'normal' && mdc != null && Math.abs(pct) < mdc) {
      withinError = true;
      change = DOWNGRADE[change];
      sev = Math.min(sev, SEVERITY_CAP[change]);
      reasons.push(`${signed(pct)} vs línea base, pero menor que el error de medición (${fmt(mdc)} %)`);
    } else if (change !== 'normal') {
      reasons.push(`${signed(pct)} vs línea base (aviso ≥ ${th.warning_pct} %, crítico ≥ ${th.critical_pct} %)`);
    }
    severity = Math.max(severity, sev);
  }

  const status = worst(abs.status, change);
  return {
    ...info,
    value: round(v, 2),
    baseline: round(value(subject, BASELINE, metric), 2),
    pct_change: round(pct, 1),
    status,
    status_label: STATUS_LABEL[status],
    severity: round(severity, 3),
    driver: change !== 'normal' && abs.status !== 'normal' ? 'both' : change !== 'normal' ? 'change' : abs.status !== 'normal' ? 'absolute' : null,
    reasons,
    within_measurement_error: withinError,
    reference: ref ? { normal_min: ref.normal_min, normal_max: ref.normal_max, critical_low: ref.critical_low, critical_high: ref.critical_high, source_id: ref.primary_source_id } : null,
    change_threshold: th ? { direction: th.direction, warning_pct: th.warning_pct, critical_pct: th.critical_pct } : null,
    mdc95_pct: mdc,
  };
}

// Bandas del puntaje (heurística del proyecto; ver docs/CARDIOVASCULAR_MONITORING.md).
export const SCORE_BANDS = { normal: 80, warning: 60 };
const band = (score) => (score == null ? null : score >= SCORE_BANDS.normal ? 'normal' : score >= SCORE_BANDS.warning ? 'warning' : 'critical');
// Un valor fuera de un límite crítico de guía clínica marca la región como crítica sin importar el puntaje.
const clinicalCritical = (e) => e.status === 'critical' && (e.driver === 'absolute' || e.driver === 'both');

/** Puntaje por región del corazón y puntaje global (0-100, 100 = sin cambios adversos). */
export function regionScores(subject, tp) {
  const out = regions.map((r) => {
    const evals = r.metrics.map((m) => ({ weight: m.weight, e: evaluateMetric(subject, tp, m.metric_code) })).filter((x) => x.e);
    const scored = evals.filter((x) => x.weight > 0);
    const w = scored.reduce((s, x) => s + x.weight, 0);
    const score = w ? Math.round(100 * (1 - scored.reduce((s, x) => s + x.weight * x.e.severity, 0) / w)) : null;
    const status = scored.some((x) => clinicalCritical(x.e)) ? 'critical' : band(score);
    return {
      region_code: r.region_code,
      name_es: r.name_es,
      name_en: r.name_en,
      description_es: r.description_es,
      weight: r.weight,
      score,
      status,
      status_label: status ? STATUS_LABEL[status] : 'Sin datos',
      metrics: evals.map((x) => ({ ...x.e, weight: x.weight })),
    };
  });
  const scored = out.filter((r) => r.score != null);
  const w = scored.reduce((s, r) => s + r.weight, 0);
  const score = w ? Math.round(scored.reduce((s, r) => s + r.weight * r.score, 0) / w) : null;
  let status = band(score);
  if (status && out.some((r) => r.metrics.some((m) => m.weight > 0 && clinicalCritical(m)))) status = 'critical';
  else if (status && out.some((r) => r.status === 'critical')) status = worst(status, 'warning');
  return {
    score,
    status,
    status_label: status ? STATUS_LABEL[status] : 'Sin datos',
    bands: { nominal_min: SCORE_BANDS.normal, attention_min: SCORE_BANDS.warning },
    regions: out,
  };
}

/**
 * Función diastólica con los criterios de la guía ASE/EACVI 2016 que hay en CFT70
 * (no hay volumen de aurícula izquierda). Disfunción si más de la mitad de los criterios disponibles
 * son positivos; normal si menos de la mitad; indeterminada si exactamente la mitad.
 */
export function diastolicFunction(subject, tp) {
  const e = (m) => value(subject, tp, m);
  const criteria = [
    { code: 'e_e_prime_avg_gt_14', label_es: "E/e' promedio > 14", value: e('e_e_prime_avg'), positive: e('e_e_prime_avg') == null ? null : e('e_e_prime_avg') > 14 },
    {
      code: 'e_prime_low', label_es: "e' septal < 7 o e' lateral < 10 cm/s",
      value: [e('e_prime_septal'), e('e_prime_lateral')].map((x) => round(x, 1)),
      positive: e('e_prime_septal') == null && e('e_prime_lateral') == null ? null : (e('e_prime_septal') ?? 99) < 7 || (e('e_prime_lateral') ?? 99) < 10,
    },
    { code: 'tr_velocity_gt_2_8', label_es: 'Velocidad de regurgitación tricuspídea > 2.8 m/s', value: e('tricuspid_regurgitation') == null ? null : e('tricuspid_regurgitation') / 100, positive: e('tricuspid_regurgitation') == null ? null : e('tricuspid_regurgitation') > 280 },
    { code: 'lavi_gt_34', label_es: 'Volumen auricular izquierdo indexado > 34 mL/m²', value: null, positive: null },
  ].map((c) => ({ ...c, value: Array.isArray(c.value) ? c.value : round(c.value, 2) }));
  const available = criteria.filter((c) => c.positive != null);
  const positives = available.filter((c) => c.positive).length;
  const half = available.length / 2;
  const classification = !available.length ? 'sin_datos' : positives > half ? 'disfuncion' : positives < half ? 'normal' : 'indeterminada';
  return {
    classification,
    label_es: { normal: 'Función diastólica normal', disfuncion: 'Posible disfunción diastólica', indeterminada: 'Indeterminada', sin_datos: 'Sin datos' }[classification],
    positives,
    available: available.length,
    criteria,
    source_id: 'SRC_ASE_DIASTOLIC',
  };
}

// ── Alertas y recomendaciones ────────────────────────────────────────────
function pickRule(metric, level, driver) {
  const preferred = driver === 'change' || driver === 'both' ? 'change_from_baseline' : 'absolute';
  const candidates = rules.filter((r) => r.metric_code === metric && r.level === level);
  return candidates.find((r) => r.condition_type === preferred) ?? candidates[0]
    ?? rules.find((r) => r.metric_code === metric) ?? null;
}

/** Métricas que se pueden evaluar: las que tienen rango clínico o umbral de cambio. */
const EVALUABLE = [...metrics.keys()].filter((m) => references.has(m) || changeThresholds.has(m));

export function subjectAlerts(subject, tp) {
  return EVALUABLE.map((m) => evaluateMetric(subject, tp, m))
    .filter((e) => e && e.status !== 'normal')
    .map((e) => {
      const rule = pickRule(e.metric_code, e.status, e.driver);
      const m = metrics.get(e.metric_code);
      return {
        subject_code: subject,
        timepoint_code: tp,
        level: e.status,
        level_label: e.status_label,
        metric_code: e.metric_code,
        metric_name: e.name_es,
        unit: e.unit,
        value: e.value,
        pct_change: e.pct_change,
        reasons: e.reasons,
        problem_code: rule?.problem_code ?? m?.problem_code ?? null,
        problem_name: m?.problem_name ?? null,
        severity: e.severity,
        rule_id: rule?.rule_id ?? null,
        condition: rule?.condition_es ?? e.reasons[0] ?? 'Valor fuera del rango de referencia',
        action: rule?.action_es ?? 'Repetir la medición y revisar con el cirujano de vuelo si persiste.',
        countermeasure_code: rule?.countermeasure_code ?? 'MEDICAL_CONSULT',
        countermeasure_name: rule?.countermeasure_name ?? 'Consulta con el cirujano de vuelo',
      };
    })
    .sort((a, b) => (b.level === 'critical') - (a.level === 'critical') || b.severity - a.severity);
}

const GROUP_COUNTERMEASURE = { EXERCISE_A: 'EXERCISE_ISS', EXERCISE_B: 'EXERCISE_ISS', FLYWHEEL: 'EXERCISE_FLYWHEEL' };

/** Contramedida actual del sujeto y la recomendada según la evidencia del propio estudio. */
export function countermeasurePlan(subject) {
  const group = groupByCode.get(subject.group_code);
  const best = bestProtocol('BR70', 'lv_mass');
  return {
    current: group?.is_countermeasure ? { group_code: group.group_code, name_es: group.name_es, countermeasure_code: GROUP_COUNTERMEASURE[group.group_code] } : null,
    recommended: best && { group_code: best.group_code, name_es: best.group_name, countermeasure_code: GROUP_COUNTERMEASURE[best.group_code], lv_mass_pct_d70: best.mean_pct_change },
  };
}

/** Evidencia de grupo para el momento consultado: el grupo del sujeto frente a Control y al mejor protocolo. */
export function groupEvidence(subject, tp) {
  if (tp === BASELINE) return null;
  const own = groupEffect(subject.group_code, tp, 'lv_mass');
  const control = groupEffect('CONTROL', tp, 'lv_mass');
  const best = bestProtocol(tp, 'lv_mass');
  if (!best || !control.n) return null;
  return {
    metric_code: 'lv_mass',
    own_group: { group_code: own.group_code, name_es: own.group_name, n: own.n, mean_pct_change: own.mean_pct_change },
    control: { n: control.n, mean_pct_change: control.mean_pct_change },
    best: { group_code: best.group_code, name_es: best.group_name, n: best.n, mean_pct_change: best.mean_pct_change, vs_control: best.vs_control },
    text_es: `${best.group_name} mantuvo la masa del ventrículo izquierdo en ${signed(best.mean_pct_change)}; el Control cambió ${signed(control.mean_pct_change)}.`,
  };
}

export function recommendations(subject, tp, alerts) {
  const recs = alerts.map((a) => ({
    kind: 'alert',
    level: a.level,
    title_es: `${a.metric_name} ${a.pct_change != null && a.pct_change !== 0 ? signed(a.pct_change) : `${a.value} ${a.unit ?? ''}`.trim()}`,
    detail_es: a.condition,
    action_es: a.action,
    countermeasure_code: a.countermeasure_code,
    metric_code: a.metric_code,
  }));
  const ev = groupEvidence(subject, tp);
  if (ev) recs.push({ kind: 'group_evidence', level: 'info', title_es: `Evidencia grupal · ${findTimepoint(tp).short_label}`, detail_es: ev.text_es, action_es: null, countermeasure_code: GROUP_COUNTERMEASURE[ev.best.group_code], metric_code: 'lv_mass' });
  const plan = countermeasurePlan(subject);
  if (!plan.current && plan.recommended) {
    recs.push({ kind: 'countermeasure', level: 'info', title_es: `Iniciar ${plan.recommended.name_es}`, detail_es: 'El sujeto no tiene contramedida de ejercicio asignada.', action_es: 'Asignar el protocolo de ejercicio aeróbico y de resistencia con mejor resultado en CFT70.', countermeasure_code: plan.recommended.countermeasure_code, metric_code: 'lv_mass' });
  }

  const traj = trajectoryAlarm(subject.subject_code ?? subject, 'lv_mass', tp);
  if (traj?.alarm_tp) {
    recs.push({
      kind: 'trend',
      level: 'warning',
      title_es: `Tendencia sostenida a la baja en ${traj.metric.name_es} (desde ${traj.alarm_tp})`,
      detail_es: `El cambio acumulado supera lo esperable por error de medición (σ = ${traj.sigma_pct} %).`,
      action_es: 'Confirmar con una segunda medición y verificar que la contramedida se cumple.',
      countermeasure_code: 'MEDICAL_CONSULT',
      metric_code: traj.metric.metric_code,
    });
  }

  return recs;
}

/** Fenotipo de respuesta del sujeto al día 70 (k-means con k = 2) e índice de desacondicionamiento. */
export function phenotypeOf(subjectCode) {
  return phenotypes(2, 'BR70').assignments[subjectCode] ?? null;
}
