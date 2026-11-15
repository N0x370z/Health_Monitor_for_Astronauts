import { all } from '../db.js';
import {
  correlations, countermeasureSummary, effects, phenotypes, predictors, reliability,
} from '../services/analytics.js';
import { BASELINE, echoData, findMetric, findTimepoint, groups, metricInfo, study, subjects, timepoints } from '../services/dataset.js';
import { HttpError } from '../http.js';

// Los análisis de cambio no tienen sentido en la línea base (todo cambio es 0 %).
function changeTimepoint(code) {
  const tp = findTimepoint(code ?? 'BR70');
  if (tp.timepoint_code === BASELINE) throw new HttpError(400, 'Pre es la línea base: elige un momento posterior (D7…R+3)');
  return tp.timepoint_code;
}

const KEY_METRICS = ['lv_mass', 'stroke_volume', 'lvedv', 'lvot_vti', 'hr_tdi_left', 'cardiac_output', 'e_a_ratio', 'lvef', 'e_e_prime_avg', 'tei_index'];

export function register(router) {
  router.get('/api/study/cft70', () => ({
    study,
    groups: groups.map((g) => ({ ...g, subjects: subjects.filter((s) => s.group_code === g.group_code).length })),
    timepoints,
    key_metrics: KEY_METRICS.map((m) => ({ ...metricInfo(m), problem_code: findMetric(m).problem_code })),
    data_quality: all('SELECT quality_flag, COUNT(*) AS n FROM study_echo_measurement GROUP BY quality_flag'),
  }));

  // Todos los valores del eco (lo que carga el frontend al iniciar).
  router.get('/api/study/cft70/echo-data', () => echoData());

  // Cambio medio (%) vs antes del reposo por grupo y momento, con IC 95 %, prueba t y g de Hedges vs Control.
  router.get('/api/study/cft70/effects', (_, query) => {
    const metric = query.get('metric') ?? 'lv_mass';
    findMetric(metric);
    return effects(metric, query.get('timepoint') ?? undefined);
  });

  router.get('/api/study/cft70/countermeasures', (_, query) => countermeasureSummary(changeTimepoint(query.get('timepoint'))));

  // ── Minería de datos ──
  router.get('/api/analytics/reliability', () => ({
    method: 'Dos analistas (A2 y A3) leyeron las mismas imágenes 3D. ICC(2,1) de acuerdo absoluto, SEM = √MSE, ' +
      'MDC95 = 1.96·√2·SEM (un analista) o 1.96·SEM (promedio de dos), sesgo y límites de acuerdo de Bland-Altman.',
    note_es: 'Mide solo el error de lectura entre analistas, no la variación al adquirir otra imagen: es un límite inferior del error real.',
    sources: ['SRC_SHROUT_FLEISS', 'SRC_WEIR', 'SRC_BLAND_ALTMAN'],
    metrics: reliability(),
  }));

  router.get('/api/analytics/correlations', (_, query) => correlations(changeTimepoint(query.get('timepoint'))));

  router.get('/api/analytics/predictors', () => predictors());

  router.get('/api/analytics/phenotypes', (_, query) => {
    const k = Number(query.get('k') ?? 2);
    if (![2, 3, 4].includes(k)) throw new HttpError(400, 'k debe ser 2, 3 o 4');
    return phenotypes(k, changeTimepoint(query.get('timepoint')));
  });
}
