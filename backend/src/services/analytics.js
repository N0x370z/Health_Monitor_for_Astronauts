import {
  BASELINE, COMPARISON_GROUPS, analyzerPairs, findTimepoint, groupByCode, metricInfo, metricsWithReads,
  pctChange, publicTimepoint, subjects, subjectsInGroup, timepoints, value,
} from './dataset.js';
import { cusumLower, evaluateEarlySignal } from './mining.js';
import {
  agreement, benjaminiHochberg, formatP, hedgesG, kmeans, mean, oneSample, pearson, round, roundP, spearman, standardize, welch,
} from './stats.js';

// Minería de datos sobre el estudio real CFT70. Todo se calcula una vez y se guarda en caché.
const cache = new Map();
const memo = (key, fn) => (cache.has(key) ? cache.get(key) : (cache.set(key, fn()), cache.get(key)));

const r2 = (x) => round(x, 2);
const r3 = (x) => round(x, 3);
const ci = (c, d = 2) => (c ? c.map((x) => round(x, d)) : null);
const signed = (x, d = 1) => (x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(d)} %`);

// ── 1. Confiabilidad del eco 3D (dos analistas leyeron las mismas imágenes) ──
export function reliability() {
  return memo('reliability', () => metricsWithReads.map((m) => {
    const a = agreement(analyzerPairs(m));
    return a && {
      ...metricInfo(m),
      pairs: a.n,
      icc: r3(a.icc),
      sem: r2(a.sem),
      sem_pct: r2(a.sem_pct),
      mdc95_single_pct: r2(a.mdc95_single_pct),
      mdc95_mean2_pct: r2(a.mdc95_mean2_pct),
      bias: r2(a.bias),
      limits_of_agreement: ci(a.limits_of_agreement),
      interpretation: a.icc >= 0.9 ? 'excelente' : a.icc >= 0.75 ? 'buena' : a.icc >= 0.5 ? 'moderada' : 'baja',
    };
  }).filter(Boolean));
}

/** Cambio mínimo detectable (%) de una métrica 3D, con el promedio de dos analistas. */
export function mdcPct(metric) {
  return reliability().find((r) => r.metric_code === metric)?.mdc95_mean2_pct ?? null;
}

// ── 2. Efecto por grupo y momento ────────────────────────────────────────
function pctsOf(group, tp, metric) {
  return subjectsInGroup(group).map((s) => pctChange(s, tp, metric)).filter((x) => x != null);
}

export function groupEffect(group, tp, metric) {
  const ids = subjectsInGroup(group).filter((s) => pctChange(s, tp, metric) != null);
  const pcts = ids.map((s) => pctChange(s, tp, metric));
  const t = oneSample(pcts);
  const out = {
    group_code: group,
    group_name: groupByCode.get(group)?.name_es ?? group,
    n: ids.length,
    mean_baseline: r2(mean(ids.map((s) => value(s, BASELINE, metric)))),
    mean_value: r2(mean(ids.map((s) => value(s, tp, metric)))),
    mean_pct_change: r2(t.mean),
    sd_pct_change: r2(t.sd),
    ci95_pct_change: ci(t.ci95),
    p_vs_baseline: roundP(t.p),
    vs_control: null,
  };
  if (group !== 'CONTROL' && tp !== BASELINE) {
    const control = pctsOf('CONTROL', tp, metric);
    const w = welch(pcts, control);
    const g = hedgesG(pcts, control);
    if (w && g) {
      out.vs_control = { diff_pct: r2(w.diff), ci95: ci(w.ci95), p: roundP(w.p), hedges_g: r2(g.g), g_ci95: ci(g.ci95), magnitude: g.magnitude };
    }
  }
  return out;
}

/** Serie completa de un indicador: cada grupo en cada momento (compatible con la versión anterior). */
export function effects(metric, tpCode) {
  const tps = tpCode ? [findTimepoint(tpCode)] : timepoints;
  return memo(`effects:${metric}:${tpCode ?? '*'}`, () => COMPARISON_GROUPS.flatMap((g) => tps.map((t) => ({
    ...groupEffect(g, t.timepoint_code, metric),
    timepoint_code: t.timepoint_code,
    short_label: t.short_label,
    label_es: t.label_es,
    day_offset: t.day_offset,
    sort_order: t.sort_order,
  }))).filter((r) => r.n > 0));
}

// ── 3. Resumen de contramedidas (pantalla "Contramedidas") ────────────────
export const COUNTERMEASURE_METRICS = ['lv_mass', 'lvedv', 'stroke_volume', 'lvot_vti', 'hr_tdi_left', 'cardiac_output', 'e_a_ratio'];
const EXERCISE_GROUPS = COMPARISON_GROUPS.filter((g) => groupByCode.get(g)?.is_countermeasure);

/** Protocolo que mejor conservó una métrica (menor pérdida o menor aumento adverso). */
export function bestProtocol(tp = 'BR70', metric = 'lv_mass') {
  const rows = EXERCISE_GROUPS.map((g) => groupEffect(g, tp, metric)).filter((r) => r.n > 0);
  return rows.sort((a, b) => b.mean_pct_change - a.mean_pct_change)[0] ?? null;
}

export function countermeasureSummary(tpCode = 'BR70') {
  const tp = findTimepoint(tpCode);
  return memo(`cm:${tp.timepoint_code}`, () => {
    const t = tp.timepoint_code;
    const metricsOut = COUNTERMEASURE_METRICS.map((m) => ({
      ...metricInfo(m),
      groups: COMPARISON_GROUPS.map((g) => groupEffect(g, t, m)).filter((r) => r.n > 0),
    }));
    const control = groupEffect('CONTROL', t, 'lv_mass');
    const best = bestProtocol(t, 'lv_mass');
    const others = EXERCISE_GROUPS.filter((g) => g !== best?.group_code);
    const bestVsOthers = others.map((g) => {
      const w = welch(pctsOf(best.group_code, t, 'lv_mass'), pctsOf(g, t, 'lv_mass'));
      return { group_code: g, p: roundP(w?.p) };
    });
    const studied = subjects.filter((s) => s.group_code !== 'UNASSIGNED');

    return {
      timepoint: publicTimepoint(tp),
      cards: {
        no_countermeasure: { group_code: 'CONTROL', n: control.n, lv_mass_pct: control.mean_pct_change },
        best_protocol: best && { group_code: best.group_code, group_name: best.group_name, n: best.n, lv_mass_pct: best.mean_pct_change },
        subjects: { n: studied.length, groups: COMPARISON_GROUPS.length, bed_rest_days: 70 },
        subset_7: { n: subjects.filter((s) => s.in_subset_7).length },
      },
      insights: t === BASELINE ? [] : insights(t, control, best, bestVsOthers),
      metrics: metricsOut,
    };
  });
}

function insights(t, control, best, bestVsOthers) {
  const out = [];
  const tp = findTimepoint(t);
  if (control.n) {
    out.push({
      level: 'critical',
      text: `Sin contramedida (Control, n=${control.n}) la masa del ventrículo izquierdo cambió ${signed(control.mean_pct_change)} en ${tp.label_es.toLowerCase()}` +
        (control.ci95_pct_change ? ` (IC 95 % ${signed(control.ci95_pct_change[0])} a ${signed(control.ci95_pct_change[1])}; ${formatP(control.p_vs_baseline)}).` : '.'),
    });
  }
  const ex = EXERCISE_GROUPS.map((g) => groupEffect(g, t, 'lv_mass')).filter((r) => r.n).sort((a, b) => b.mean_pct_change - a.mean_pct_change);
  if (ex.length && best) {
    const sig = bestVsOthers.every((x) => x.p != null && x.p >= 0.05);
    out.push({
      level: 'normal',
      text: `Los protocolos de ejercicio limitaron la pérdida: ${ex.map((r) => `${r.group_name} ${signed(r.mean_pct_change)}`).join(', ')}. ` +
        `${best.group_name} contra Control: g de Hedges ${best.vs_control?.hedges_g} (${best.vs_control?.magnitude}), ${formatP(best.vs_control?.p)}.` +
        (sig ? ' Las diferencias entre protocolos de ejercicio no son significativas: lo que más protege es hacer ejercicio, sea cual sea el protocolo.' : ''),
    });
  }
  const sv = groupEffect('CONTROL', t, 'stroke_volume');
  const hr = groupEffect('CONTROL', t, 'hr_tdi_left');
  const co = groupEffect('CONTROL', t, 'cardiac_output');
  if (sv.n && hr.n && co.n) {
    out.push({
      level: 'warning',
      text: `En Control el volumen sistólico cambió ${signed(sv.mean_pct_change)} y la FC ${signed(hr.mean_pct_change)}; el gasto cardiaco quedó en ${signed(co.mean_pct_change)}. ` +
        'La FC compensa el menor llenado: un gasto cardiaco estable no descarta el desacondicionamiento.',
    });
  }
  const ret = groupEffect('CONTROL', 'R+0', 'hr_tdi_left');
  const vti = groupEffect('CONTROL', 'R+0', 'lvot_vti');
  if (ret.n && vti.n) {
    out.push({
      level: 'warning',
      text: `Al regresar (R+0) en Control la FC sube ${signed(ret.mean_pct_change)} y el VTI del TSVI cambia ${signed(vti.mean_pct_change)}: es el patrón de desacondicionamiento que provoca mareos al ponerse de pie. ` +
        'Planear carga de líquidos y prueba ortostática antes del regreso.',
    });
  }
  return out;
}

// ── 4. Correlaciones entre cambios ───────────────────────────────────────
export const MINING_METRICS = ['lv_mass', 'lvedv', 'stroke_volume', 'lvot_vti', 'hr_tdi_left', 'cardiac_output', 'e_a_ratio', 'e_e_prime_avg', 'tei_index'];
const studyIds = () => subjects.filter((s) => s.group_code !== 'UNASSIGNED').map((s) => s.subject_code);

export function correlations(tpCode = 'BR70') {
  const tp = findTimepoint(tpCode);
  if (tp.timepoint_code === BASELINE) return { timepoint: publicTimepoint(tp), metrics: [], pairs: [] };
  return memo(`corr:${tp.timepoint_code}`, () => {
    const ids = studyIds();
    const series = Object.fromEntries(MINING_METRICS.map((m) => [m, ids.map((s) => pctChange(s, tp.timepoint_code, m))]));
    const out = [];
    MINING_METRICS.forEach((a, i) => MINING_METRICS.slice(i + 1).forEach((b) => {
      const p = pearson(series[a], series[b]);
      const s = spearman(series[a], series[b]);
      if (p) out.push({ x: a, y: b, n: p.n, r: r3(p.r), p: p.p, spearman_rho: r3(s?.rho) });
    }));
    const q = benjaminiHochberg(out.map((o) => o.p));
    return {
      timepoint: publicTimepoint(tp),
      method: 'Pearson y Spearman sobre el % de cambio vs línea base; valores q con Benjamini-Hochberg.',
      metrics: MINING_METRICS.map(metricInfo),
      pairs: out.map((o, i) => ({ ...o, p: roundP(o.p), q: roundP(q[i]), significant: q[i] < 0.05 }))
        .sort((a, b) => Math.abs(b.r) - Math.abs(a.r)),
    };
  });
}

// ── 5. Predictores: qué cambio temprano anticipa el problema ──────────────
const PREDICTION_SETS = [
  {
    code: 'early_warning',
    title_es: 'Cambios del día 7 que anticipan las pérdidas del día 70',
    predictor_tp: 'BR7',
    outcome_tp: 'BR70',
    outcomes: ['lv_mass', 'stroke_volume', 'lvot_vti'],
  },
  {
    code: 'orthostatic_risk',
    title_es: 'Cambios del día 70 que anticipan la subida de FC al regresar (R+0)',
    predictor_tp: 'BR70',
    outcome_tp: 'R+0',
    outcomes: ['hr_tdi_left'],
  },
];

export function predictors() {
  return memo('predictors', () => {
    const ids = studyIds();
    return PREDICTION_SETS.map((set) => {
      const rows = [];
      for (const outcome of set.outcomes) {
        const y = ids.map((s) => pctChange(s, set.outcome_tp, outcome));
        for (const pred of MINING_METRICS) {
          const x = ids.map((s) => pctChange(s, set.predictor_tp, pred));
          const p = pearson(x, y);
          if (!p) continue;
          rows.push({
            predictor: { ...metricInfo(pred), timepoint: set.predictor_tp },
            outcome: { ...metricInfo(outcome), timepoint: set.outcome_tp },
            n: p.n, r: p.r, p: p.p, r2: p.r2, slope: p.slope, intercept: p.intercept,
            spearman_rho: spearman(x, y)?.rho,
          });
        }
      }
      const q = benjaminiHochberg(rows.map((r) => r.p));
      const results = rows.map((r, i) => ({
        ...r, r: r3(r.r), p: roundP(r.p), q: roundP(q[i]), r2: r3(r.r2), slope: r3(r.slope), intercept: r2(r.intercept),
        spearman_rho: r3(r.spearman_rho), significant: q[i] < 0.05,
        reading_es: q[i] < 0.05 ? readPrediction(r) : null,
      })).sort((a, b) => a.p - b.p);
      return { ...set, method: 'Regresión lineal simple sobre el % de cambio de cada sujeto; q de Benjamini-Hochberg dentro del conjunto.', results };
    });
  });
}

function readPrediction(r) {
  const step = r.predictor.metric_code === 'hr_tdi_left' || r.predictor.metric_code === 'tei_index' ? 10 : -10;
  const effect = r.slope * step;
  return `Por cada ${signed(step, 0)} de cambio en ${r.predictor.name_es} (${r.predictor.timepoint}), ` +
    `${r.outcome.name_es} (${r.outcome.timepoint}) cambia en promedio ${signed(effect)} (r=${r.r.toFixed(2)}).`;
}

// ── 6. Fenotipos de respuesta (k-means) ──────────────────────────────────
export const PHENOTYPE_FEATURES = ['lv_mass', 'stroke_volume', 'lvot_vti', 'hr_tdi_left', 'e_a_ratio'];
// Signo que convierte cada cambio en "desacondicionamiento" (más alto = peor).
const ADVERSE_SIGN = { lv_mass: -1, stroke_volume: -1, lvot_vti: -1, hr_tdi_left: 1, e_a_ratio: -1 };

/** Nombre del fenotipo según el índice de desacondicionamiento del centroide (en desviaciones estándar). */
export function phenotypeLabel(index) {
  return index > 0.25 ? 'Desacondicionamiento alto' : index >= -0.25 ? 'Desacondicionamiento moderado' : 'Protegido';
}

export function phenotypes(k = 2, tpCode = 'BR70') {
  const tp = findTimepoint(tpCode);
  return memo(`pheno:${k}:${tp.timepoint_code}`, () => {
    const ids = studyIds().filter((s) => PHENOTYPE_FEATURES.every((m) => pctChange(s, tp.timepoint_code, m) != null));
    const rows = ids.map((s) => PHENOTYPE_FEATURES.map((m) => pctChange(s, tp.timepoint_code, m)));
    if (rows.length < k * 2) return { timepoint: publicTimepoint(tp), k, clusters: [], assignments: {} };
    const { z } = standardize(rows);
    const km = kmeans(z, k);
    const deconditioning = (zrow) => mean(zrow.map((v, j) => v * ADVERSE_SIGN[PHENOTYPE_FEATURES[j]]));
    const clusters = Array.from({ length: k }, (_, c) => {
      const idx = km.labels.map((l, i) => (l === c ? i : -1)).filter((i) => i >= 0);
      return {
        index: c,
        size: idx.length,
        deconditioning_index: deconditioning(km.centroids[c]),
        mean_pct_change: Object.fromEntries(PHENOTYPE_FEATURES.map((m, j) => [m, r2(mean(idx.map((i) => rows[i][j])))])),
        composition: Object.fromEntries(COMPARISON_GROUPS.map((g) => [g, idx.filter((i) => subjects.find((s) => s.subject_code === ids[i]).group_code === g).length])),
        subjects: idx.map((i) => ids[i]),
      };
    }).sort((a, b) => b.deconditioning_index - a.deconditioning_index);
    clusters.forEach((c, i) => {
      c.label_es = phenotypeLabel(c.deconditioning_index);
      c.rank = i + 1;
      c.deconditioning_index = r2(c.deconditioning_index);
      delete c.index;
    });
    const assignments = {};
    for (const c of clusters) {
      for (const s of c.subjects) {
        assignments[s] = { rank: c.rank, label_es: c.label_es, deconditioning_index: r2(deconditioning(z[ids.indexOf(s)])) };
      }
    }
    return {
      timepoint: publicTimepoint(tp),
      k,
      features: PHENOTYPE_FEATURES.map(metricInfo),
      method: 'k-means++ (50 reinicios, semilla fija) sobre el % de cambio estandarizado (z). Índice de desacondicionamiento = promedio de z con signo adverso (0 = promedio del estudio; positivo = peor).',
      quality_es: km.silhouette >= 0.5 ? 'estructura fuerte' : km.silhouette >= 0.25 ? 'estructura razonable' : 'estructura débil: los fenotipos son un continuo, usar el índice más que la etiqueta',
      silhouette: r3(km.silhouette),
      clusters,
      assignments,
    };
  });
}

// ── 7. Señal temprana y tendencia (validación fuera de muestra) ──────────
/** Error típico de medición (% de la media) del eco 3D; sirve de σ para el CUSUM. */
const semPct = (metric) => reliability().find((r) => r.metric_code === metric)?.sem_pct ?? null;

/**
 * ¿La pérdida temprana anticipa la pérdida final? Validado dejando un sujeto fuera.
 * Evento = pérdida final ≥ cambio mínimo detectable (MDC95) de la métrica.
 */
export function earlyWarningValidation(metric = 'lv_mass', earlyTp = 'BR7', finalTp = 'BR70') {
  return memo(`ew:${metric}:${earlyTp}:${finalTp}`, () => {
    const mdc = mdcPct(metric);
    if (mdc == null) return null;
    const rows = studyIds().map((s) => ({
      id: s,
      exercise: groupByCode.get(subjects.find((x) => x.subject_code === s).group_code)?.is_countermeasure ? 1 : 0,
      x: pctChange(s, earlyTp, metric),
      y: pctChange(s, finalTp, metric),
    }));
    return {
      metric: metricInfo(metric),
      early_tp: earlyTp,
      final_tp: finalTp,
      ...evaluateEarlySignal(rows, mdc),
      method: 'AUC con IC 95 % por bootstrap y p de permutación; regresión logística ridge evaluada dejando un sujeto fuera (Brier skill > 0 = mejor que predecir la prevalencia).',
    };
  });
}

const TREND_TPS = ['BR7', 'BR21', 'BR30', 'BR70'];

/**
 * CUSUM inferior sobre el % de cambio, medido en unidades del error de medición.
 * upToTp: solo usa datos hasta ese momento (un aviso temprano no puede ver el futuro).
 */
export function trajectoryAlarm(subjectCode, metric = 'lv_mass', upToTp = null) {
  const sigma = semPct(metric);
  if (!sigma) return null;
  const limit = upToTp ? findTimepoint(upToTp).sort_order : Infinity;
  // Ignora los momentos que no existan en tu tabla study_timepoint (por ejemplo BR21 o BR30).
  const tps = TREND_TPS.flatMap((c) => { try { return [findTimepoint(c)]; } catch { return []; } })
    .filter((t) => t.sort_order <= limit);
  if (!tps.length) return null;
  const pcts = tps.map((t) => pctChange(subjectCode, t.timepoint_code, metric));
  if (pcts.every((p) => p == null)) return null;
  const { path, alarm } = cusumLower(pcts.map((p) => (p == null ? null : p / sigma)));
  return {
    metric: metricInfo(metric),
    sigma_pct: r2(sigma),
    points: tps.map((t, i) => ({ short_label: t.short_label, pct_change: pcts[i] == null ? null : r2(pcts[i]), cusum: path[i] == null ? null : r2(path[i]) })),
    alarm_tp: alarm == null ? null : tps[alarm].short_label,
    method: 'CUSUM inferior (k=0.5, h=4) sobre el % de cambio en unidades de error de medición (SEM).',
  };
}