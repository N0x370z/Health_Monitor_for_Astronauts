import { all, get } from '../db.js';
import { HttpError } from '../http.js';
import { crewAlerts, episodes24h, riskSummary } from '../services/alerts.js';
import { shiftDate, shiftTs, windowStart } from '../services/time.js';

const VITALS = ['heart_rate', 'systolic_bp', 'diastolic_bp', 'spo2', 'body_temp'];
const ECHO = ['lv_mass', 'lvedv', 'stroke_volume', 'lvot_vti', 'e_a_ratio', 'lvef', 'e_e_prime_ratio'];

function findCrew(code) {
  const crew = get(
    `SELECT c.*, m.name_es AS mission_name, m.environment_context, m.gravity_g, m.current_mission_day,
            m.duration_days, m.countermeasure_hardware
     FROM crew_member c JOIN mission m USING (mission_code) WHERE c.crew_code = ?`, code);
  if (!crew) throw new HttpError(404, `Tripulante ${code} no encontrado`);
  return crew;
}

function latestVitals(code) {
  return Object.fromEntries(
    all('SELECT metric_code, value, status, ts FROM v_latest_vitals WHERE crew_code = ?', code)
      .map((v) => [v.metric_code, { value: v.value, status: v.status, ts: shiftTs(v.ts) }]),
  );
}

export function register(router) {
  router.get('/api/missions', () =>
    all(`SELECT m.*, COUNT(c.crew_code) AS crew_count
         FROM mission m LEFT JOIN crew_member c USING (mission_code)
         GROUP BY m.mission_code ORDER BY m.mission_code`));

  router.get('/api/crew', (_, query) => {
    const mission = query.get('mission');
    const crew = all(
      `SELECT c.crew_code, c.mission_code, c.role, m.name_es AS mission_name
       FROM crew_member c JOIN mission m USING (mission_code)
       WHERE (? IS NULL OR c.mission_code = ?) ORDER BY c.crew_code`, mission, mission);
    return crew.map((c) => {
      const alerts = crewAlerts(c.crew_code, c.mission_code);
      return { ...c, risk: riskSummary(alerts), vitals: latestVitals(c.crew_code) };
    });
  });

  router.get('/api/crew/:code', ({ code }) => {
    const crew = findCrew(code);
    const alerts = crewAlerts(code, crew.mission_code);
    const echo = all(
      `SELECT metric_code, mission_day, date, value, pct_change_from_baseline AS pct, status
       FROM daily_measurement WHERE crew_code = ? AND metric_code IN (${ECHO.map(() => '?').join(',')})
       ORDER BY metric_code, mission_day`, code, ...ECHO).map((r) => ({ ...r, date: shiftDate(r.date) }));
    return { crew, vitals: latestVitals(code), risk: riskSummary(alerts), alerts, episodes_24h: episodes24h(code, crew.mission_code), echo };
  });

  router.get('/api/crew/:code/vitals', ({ code }, query) => {
    findCrew(code);
    const hours = Math.min(24, Math.max(1, Number(query.get('hours') ?? 24)));
    const metric = query.get('metric');
    if (metric && !VITALS.includes(metric)) throw new HttpError(400, `Métrica no válida: ${metric}`);
    return all(
      `SELECT ts, metric_code, value, status, activity, event_id FROM measurement
       WHERE crew_code = ? AND ts > ? AND (? IS NULL OR metric_code = ?) ORDER BY metric_code, ts`,
      code, windowStart(hours), metric, metric).map((r) => ({ ...r, ts: shiftTs(r.ts) }));
  });

  router.get('/api/crew/:code/history', ({ code }, query) => {
    findCrew(code);
    const metric = query.get('metric');
    return all(
      `SELECT d.metric_code, d.mission_day, d.date, d.value, d.pct_change_from_baseline AS pct, d.status, d.event_id,
              m.name_es AS metric_name, m.unit, m.category
       FROM daily_measurement d JOIN metric m USING (metric_code)
       WHERE d.crew_code = ? AND (? IS NULL OR d.metric_code = ?) ORDER BY d.metric_code, d.mission_day`,
      code, metric, metric).map((r) => ({ ...r, date: shiftDate(r.date) }));
  });

  // Endpoint del README: métricas de las últimas 24 h (formato largo, filtrable).
  router.get('/api/metrics/last-24h', (_, query) => {
    const crew = query.get('crew');
    const mission = query.get('mission');
    const metric = query.get('metric');
    return all(
      `SELECT ts, mission_code, crew_code, metric_code, value, status, activity FROM measurement
       WHERE (? IS NULL OR crew_code = ?) AND (? IS NULL OR mission_code = ?) AND (? IS NULL OR metric_code = ?)
       ORDER BY ts`, crew, crew, mission, mission, metric, metric).map((r) => ({ ...r, ts: shiftTs(r.ts) }));
  });
}
