import {
  countermeasurePlan, diastolicFunction, evaluateMetric, phenotypeOf, recommendations, regionScores, subjectAlerts,
} from '../services/assessment.js';
import {
  BASELINE, findSubject, findTimepoint, metricInfo, metrics, pctChange, publicSubject, publicTimepoint, subjects,
  timepoints, value,
} from '../services/dataset.js';
import { round, slope } from '../services/stats.js';

// Métricas de la tabla de ecocardiografía, en el orden del diseño del frontend.
export const ECHO_TABLE = [
  'lv_mass', 'lvedv', 'stroke_volume', 'lvef', 'cardiac_output', 'hr_tdi_left', 'lvot_vti', 'fractional_shortening',
  'e_a_ratio', 'e_e_prime_ratio', 'e_e_prime_avg', 'tei_index', 's_prime_tricuspid', 'rvsp',
];
const KEY_VALUES = ['lvef', 'cardiac_output', 'hr_tdi_left'];
const IN_TEST = timepoints.filter((t) => t.phase !== 'POST_TEST');

function summary(s, tp) {
  const a = regionScores(s.subject_code, tp);
  return {
    ...publicSubject(s),
    score: a.score,
    status: a.status,
    status_label: a.status_label,
    lv_mass_pct_change: round(pctChange(s.subject_code, tp, 'lv_mass'), 1),
    heart_rate: round(value(s.subject_code, tp, 'hr_tdi_left'), 0),
    phenotype: phenotypeOf(s.subject_code),
  };
}

/** Tendencia durante el reposo en cama: pendiente del % de cambio, en puntos porcentuales por semana. */
function bedRestSlope(subject, metric) {
  const pts = IN_TEST.map((t) => [t.day_offset, t.timepoint_code === BASELINE ? 0 : pctChange(subject, t.timepoint_code, metric)])
    .filter(([, y]) => y != null);
  if (pts.length < 3) return null;
  const b = slope(pts.map((p) => p[0]), pts.map((p) => p[1]));
  return b == null ? null : round(b * 7, 2);
}

export function register(router) {
  router.get('/api/subjects', (_, query) => {
    const tp = findTimepoint(query.get('timepoint')).timepoint_code;
    const group = query.get('group');
    const subset = query.get('subset');
    return subjects
      .filter((s) => (!group || s.group_code === group.toUpperCase()) && (subset !== '7' || s.in_subset_7))
      .map((s) => summary(s, tp))
      .sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
  });

  router.get('/api/subjects/:code', ({ code }, query) => {
    const s = findSubject(code);
    const tp = findTimepoint(query.get('timepoint'));
    const t = tp.timepoint_code;
    const alerts = subjectAlerts(s.subject_code, t);
    return {
      subject: publicSubject(s),
      timepoint: publicTimepoint(tp),
      available_timepoints: timepoints
        .filter((x) => [...metrics.keys()].some((m) => value(s.subject_code, x.timepoint_code, m) != null))
        .map((x) => x.short_label),
      assessment: regionScores(s.subject_code, t),
      key_values: Object.fromEntries(KEY_VALUES.map((m) => [m, evaluateMetric(s.subject_code, t, m)])),
      diastolic_function: diastolicFunction(s.subject_code, t),
      countermeasure: countermeasurePlan(s),
      phenotype: phenotypeOf(s.subject_code),
      alerts,
      recommendations: recommendations(s, t, alerts),
    };
  });

  // Tabla de ecocardiografía: cada métrica en cada momento, con % de cambio y estado.
  router.get('/api/subjects/:code/echo', ({ code }, query) => {
    const s = findSubject(code);
    const list = query.get('metrics') === 'all'
      ? [...metrics.keys()].filter((m) => timepoints.some((t) => value(s.subject_code, t.timepoint_code, m) != null))
      : ECHO_TABLE;
    return {
      subject: publicSubject(s),
      timepoints: timepoints.map(publicTimepoint),
      rows: list.map((m) => ({
        ...metricInfo(m),
        bed_rest_slope_pct_per_week: bedRestSlope(s.subject_code, m),
        cells: Object.fromEntries(timepoints.map((t) => {
          const e = evaluateMetric(s.subject_code, t.timepoint_code, m);
          return [t.short_label, e && { value: e.value, pct_change: e.pct_change, status: e.status }];
        })),
      })),
    };
  });
}
