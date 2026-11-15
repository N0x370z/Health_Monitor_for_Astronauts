import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { server } from '../src/server.js';

let base;
before(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const getJson = async (path) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≈ ${b} ± ${tol}`);
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

test('health: estudio CFT70 con 38 sujetos y 7 momentos', async () => {
  const { status, body } = await getJson('/api/health');
  assert.equal(status, 200);
  assert.equal(body.subjects, 38);
  assert.deepEqual(body.timepoints, ['Pre', 'D7', 'D21', 'D30', 'D70', 'R+0', 'R+3']);
});

test('sujetos: ordenados por puntaje y filtro del subconjunto de 7', async () => {
  const all = (await getJson('/api/subjects')).body;
  assert.equal(all.length, 38);
  const scores = all.map((s) => s.score).filter((s) => s != null);
  assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
  const seven = (await getJson('/api/subjects?subset=7')).body;
  assert.equal(seven.length, 7);
  assert.ok(seven.every((s) => s.in_subset_7));
});

test('validación: antes del reposo todos están en nominal', async () => {
  const { body } = await getJson('/api/subjects?timepoint=Pre');
  assert.ok(body.filter((s) => s.score != null).every((s) => s.score >= 80 && s.status === 'normal'));
});

test('validación: al día 70 el puntaje separa a Control de los grupos con ejercicio', async () => {
  const { body } = await getJson('/api/subjects?timepoint=D70');
  const control = body.filter((s) => s.group_code === 'CONTROL').map((s) => s.score);
  const exercise = body.filter((s) => s.is_countermeasure && s.score != null).map((s) => s.score);
  for (const g of ['EXERCISE_A', 'EXERCISE_B', 'FLYWHEEL']) {
    assert.ok(avg(control) < avg(body.filter((s) => s.group_code === g).map((s) => s.score)), g);
  }
  let wins = 0;
  for (const e of exercise) for (const c of control) wins += e > c ? 1 : e === c ? 0.5 : 0;
  assert.ok(wins / (exercise.length * control.length) >= 0.9, 'AUC >= 0.9');
});

test('sujeto 6546 al D70: coincide con el estudio y recomienda ejercicio', async () => {
  const { body } = await getJson('/api/subjects/6546?timepoint=D70');
  assert.equal(body.subject.subject_code, 'S6546');
  assert.equal(body.subject.group_code, 'CONTROL');
  const lv = body.assessment.regions.find((r) => r.region_code === 'left_ventricle');
  near(lv.metrics.find((m) => m.metric_code === 'lvedv').pct_change, -30.3, 0.1);
  near(lv.metrics.find((m) => m.metric_code === 'stroke_volume').pct_change, -33.8, 0.1);
  near(body.key_values.cardiac_output.value, 4.33, 0.02);
  near(body.key_values.hr_tdi_left.value, 73.7, 0.1);
  assert.equal(body.assessment.regions.length, 5);
  assert.ok(body.assessment.score >= 0 && body.assessment.score <= 100);
  assert.equal(body.countermeasure.current, null);
  assert.equal(body.countermeasure.recommended.group_code, 'EXERCISE_B');
  assert.ok(body.recommendations.some((r) => r.kind === 'countermeasure'));
  assert.ok(body.alerts.every((a) => a.action.length > 10));
  assert.equal((await getJson('/api/subjects/S6546')).body.subject.nasa_id, '6546');
});

test('momentos: R+0 funciona con "+" y con "%2B"', async () => {
  const a = await getJson('/api/subjects/6546?timepoint=R+0');
  const b = await getJson('/api/subjects/6546?timepoint=R%2B0');
  assert.equal(a.status, 200);
  assert.equal(a.body.timepoint.timepoint_code, 'R+0');
  assert.equal(b.body.timepoint.timepoint_code, 'R+0');
});

test('tabla de eco: 14 métricas por momento y Pre sin cambio', async () => {
  const { body } = await getJson('/api/subjects/6546/echo');
  assert.equal(body.rows.length, 14);
  const mass = body.rows.find((r) => r.metric_code === 'lv_mass');
  assert.equal(mass.cells.Pre.pct_change, 0);
  assert.ok(Object.keys(mass.cells).length === 7);
  const all = (await getJson('/api/subjects/6546/echo?metrics=all')).body;
  assert.ok(all.rows.length > 30);
});

test('efectos por grupo: pérdida de masa del VI en Control y protección del ejercicio', async () => {
  const { body } = await getJson('/api/study/cft70/effects?metric=lv_mass&timepoint=D70');
  const control = body.find((r) => r.group_code === 'CONTROL');
  near(control.mean_pct_change, -13.7, 0.1);
  assert.ok(control.ci95_pct_change[1] < 0, 'el IC 95 % no cruza 0');
  const b = body.find((r) => r.group_code === 'EXERCISE_B');
  assert.ok(b.vs_control.p < 0.05 && b.vs_control.hedges_g > 0.8);
  const series = (await getJson('/api/study/cft70/effects?metric=lv_mass')).body;
  assert.ok(series.some((r) => r.timepoint_code === 'R+3'));
});

test('contramedidas: tarjetas y hallazgos calculados de los datos', async () => {
  const { body } = await getJson('/api/study/cft70/countermeasures');
  near(body.cards.no_countermeasure.lv_mass_pct, -13.7, 0.1);
  assert.equal(body.cards.best_protocol.group_code, 'EXERCISE_B');
  assert.equal(body.cards.subjects.n, 37);
  assert.equal(body.cards.subset_7.n, 7);
  assert.ok(body.insights.length >= 3);
});

test('confiabilidad 3D: acuerdo entre analistas y cambio mínimo detectable', async () => {
  const { body } = await getJson('/api/analytics/reliability');
  const mass = body.metrics.find((m) => m.metric_code === 'lv_mass');
  assert.ok(mass.icc > 0.9);
  near(mass.mdc95_mean2_pct, 6.5, 0.2);
  assert.ok(mass.pairs > 150);
});

test('un cambio menor al error de medición baja un nivel', async () => {
  const subjects = (await getJson('/api/subjects?timepoint=D70')).body;
  const candidate = subjects.find((s) => s.lv_mass_pct_change <= -5 && s.lv_mass_pct_change > -6.4);
  assert.ok(candidate, 'hay al menos un sujeto con −5 % a −6.4 %');
  const detail = (await getJson(`/api/subjects/${candidate.subject_code}?timepoint=D70`)).body;
  const mass = detail.assessment.regions[0].metrics.find((m) => m.metric_code === 'lv_mass');
  assert.equal(mass.within_measurement_error, true);
  assert.equal(mass.status, 'normal');
});

test('predictores: la caída de E/A al D70 anticipa la subida de FC al regresar', async () => {
  const { body } = await getJson('/api/analytics/predictors');
  const ortho = body.find((s) => s.code === 'orthostatic_risk');
  const ea = ortho.results.find((r) => r.predictor.metric_code === 'e_a_ratio');
  assert.ok(ea.r < -0.5 && ea.significant);
  const early = body.find((s) => s.code === 'early_warning');
  assert.ok(early.results.some((r) => r.predictor.metric_code === 'lv_mass' && r.outcome.metric_code === 'lv_mass' && r.significant));
});

test('correlaciones: SV y LVEDV van juntos al D70', async () => {
  const { body } = await getJson('/api/analytics/correlations?timepoint=D70');
  const pair = body.pairs.find((p) => [p.x, p.y].includes('stroke_volume') && [p.x, p.y].includes('lvedv'));
  assert.ok(pair.r > 0.85 && pair.significant);
});

test('fenotipos: el grupo de desacondicionamiento alto concentra a Control', async () => {
  const { body } = await getJson('/api/analytics/phenotypes');
  assert.equal(body.k, 2);
  const high = body.clusters[0];
  assert.equal(high.label_es, 'Desacondicionamiento alto');
  assert.ok(high.composition.CONTROL >= 6);
  assert.ok(body.clusters[1].composition.CONTROL <= 3);
});

test('función diastólica: criterios ASE 2016 disponibles', async () => {
  const { body } = await getJson('/api/subjects/8936?timepoint=D70');
  assert.equal(body.diastolic_function.available, 3);
  assert.ok(['normal', 'disfuncion', 'indeterminada'].includes(body.diastolic_function.classification));
});

test('alertas y conocimiento', async () => {
  const alerts = (await getJson('/api/alerts?timepoint=D70&level=critical')).body;
  assert.ok(alerts.length > 0 && alerts.every((a) => a.level === 'critical'));
  const problems = (await getJson('/api/problems')).body;
  assert.equal(problems.length, 7);
  assert.ok(problems.every((p) => p.countermeasures.length > 0));
  const ref = (await getJson('/api/reference')).body;
  assert.equal(ref.regions.length, 5);
});

test('errores: 404 y 400', async () => {
  assert.equal((await getJson('/api/subjects/NOPE')).status, 404);
  assert.equal((await getJson('/api/subjects/6546?timepoint=D99')).status, 400);
  assert.equal((await getJson('/api/study/cft70/effects?metric=x')).status, 400);
  assert.equal((await getJson('/api/analytics/phenotypes?k=9')).status, 400);
  assert.equal((await getJson('/api/crew')).status, 404);
});

test('robustez: una URL mal codificada no tumba el servidor', async () => {
  assert.equal((await getJson('/api/subjects/%E0%A4%A')).status, 400);
  assert.equal((await getJson('/api/health')).status, 200);
});

test('análisis de cambio: Pre es línea base y se rechaza', async () => {
  for (const p of ['/api/study/cft70/countermeasures', '/api/analytics/correlations', '/api/analytics/phenotypes']) {
    assert.equal((await getJson(`${p}?timepoint=Pre`)).status, 400, p);
    assert.equal((await getJson(`${p}?timepoint=R%2B0`)).status, 200, p);
  }
});

test('echo-data: todos los valores del eco para el frontend', async () => {
  const { status, body } = await getJson('/api/study/cft70/echo-data');
  assert.equal(status, 200);
  assert.equal(body.subjects.length, 38);
  assert.equal(body.subjects.filter((s) => s.in_subset_7).length, 7);
  const s = body.subjects.find((x) => x.nasa_id === '6546');
  near(s.values.D70.lvedv, 92.5, 0.1);
  near(s.values.D70.cardiac_output, 4.33, 0.01);
});

test('hueso: regiones clave con pérdida y controles sin cambio', async () => {
  const { status, body } = await getJson('/api/bone');
  assert.equal(status, 200);
  assert.equal(body.regions.length, 11);
  assert.deepEqual(body.campaigns.map((c) => c.subjects).reduce((a, b) => a + b, 0), 74);
  const r = Object.fromEntries(body.regions.map((x) => [x.region_code, x]));
  near(r.TOTAL_HIP.mean_pct_change, -2.76, 0.05);
  assert.ok(r.TOTAL_HIP.p_vs_baseline < 0.001 && r.TOTAL_HIP.lsc_pct > 2);
  assert.ok(r.FOREARM_13.p_vs_baseline > 0.05 && r.ARM.p_vs_baseline > 0.05);
  // las 4 regiones más afectadas son de carga (cadera y pelvis)
  assert.ok(body.ranking.slice(0, 4).every((x) => x.role === 'key'));
});

test('hueso: sujeto con línea de tiempo y estado frente al LSC', async () => {
  const list = (await getJson('/api/bone/subjects?campaign=UTMB_C3')).body;
  assert.equal(list.length, 32);
  const { status, body } = await getJson('/api/bone/subjects/C3-224');
  assert.equal(status, 200);
  const hip = body.regions.find((x) => x.region_code === 'TOTAL_HIP');
  assert.equal(hip.bed_rest_change.status, 'loss');
  assert.equal(hip.visits[0].visit_code, 'PRE');
  assert.equal((await getJson('/api/bone/subjects/NOPE')).status, 404);
  assert.equal((await getJson('/api/bone/subjects?campaign=XX')).status, 400);
});
