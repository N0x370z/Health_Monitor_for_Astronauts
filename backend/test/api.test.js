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

test('health responde con la base cargada', async () => {
  const { status, body } = await getJson('/api/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.crew, 16);
});

test('lista de tripulación con riesgo y signos vitales', async () => {
  const { body } = await getJson('/api/crew');
  assert.equal(body.length, 16);
  for (const c of body) {
    assert.ok(['normal', 'warning', 'critical'].includes(c.risk.level));
    assert.ok('heart_rate' in c.vitals);
  }
});

test('CREW-LEO-04 tiene atrofia cardiaca crítica con acción recomendada', async () => {
  const { body } = await getJson('/api/crew/CREW-LEO-04');
  const atrophy = body.alerts.find((a) => a.metric_code === 'lv_mass');
  assert.equal(atrophy.level, 'critical');
  assert.ok(atrophy.action.length > 10);
  assert.equal(body.risk.level, 'critical');
});

test('episodios de 24 h: palpitaciones de CREW-LEO-02 y evento solar en Marte', async () => {
  const leo = (await getJson('/api/crew/CREW-LEO-02')).body.episodes_24h;
  assert.ok(leo.some((e) => e.metric_code === 'heart_rate' && e.level === 'critical' && e.duration_min >= 30));
  const mars = (await getJson('/api/crew/CREW-MARS-02')).body.episodes_24h;
  assert.ok(mars.some((e) => e.metric_code === 'dose_rate_spike_ratio' && e.scope === 'module'));
});

test('signos vitales: 24 h cada 5 min', async () => {
  const { body } = await getJson('/api/crew/CREW-LEO-02/vitals?metric=heart_rate');
  assert.equal(body.length, 288);
  assert.ok(body.some((p) => p.status === 'critical'));
});

test('endpoint del README /api/metrics/last-24h', async () => {
  const { body } = await getJson('/api/metrics/last-24h?crew=CREW-MARS-03&metric=spo2');
  assert.equal(body.length, 288);
  const last = Date.parse(body.at(-1).ts);
  assert.ok(Math.abs(Date.now() - last) < 10 * 60_000, 'la ventana termina ahora (TIME_SHIFT)');
});

test('estudio CFT70: el grupo Control pierde masa del VI', async () => {
  const { body } = await getJson('/api/study/cft70/effects?metric=lv_mass');
  const control = body.find((r) => r.group_code === 'CONTROL' && r.timepoint_code === 'BR70');
  assert.ok(control.mean_pct_change < -10);
});

test('problemas cardiovasculares con contramedidas', async () => {
  const { body } = await getJson('/api/problems');
  assert.equal(body.length, 9);
  assert.ok(body.every((p) => p.countermeasures.length > 0));
});

test('errores: 404 y 400', async () => {
  assert.equal((await getJson('/api/crew/NOPE')).status, 404);
  assert.equal((await getJson('/api/crew/CREW-LEO-01/vitals?metric=x')).status, 400);
  assert.equal((await getJson('/api/nada')).status, 404);
});
