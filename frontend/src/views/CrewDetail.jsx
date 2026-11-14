import { useMemo } from 'react';
import { useApi } from '../api.js';
import { BloodPressureChart, DailyChart, EchoTrendChart, VitalChart } from '../components/charts.jsx';
import { AlertList, Badge, Card, Loading } from '../components/ui.jsx';
import { ROLE_LABEL, fmt, fmtTime } from '../format.js';

const REFRESH_MS = 60_000;

export default function CrewDetail({ code, onBack }) {
  const detail = useApi(`/api/crew/${code}`, REFRESH_MS);
  const vitals = useApi(`/api/crew/${code}/vitals`, REFRESH_MS);
  const history = useApi(`/api/crew/${code}/history`);
  const reference = useApi('/api/reference');
  const lvMass = useApi('/api/study/cft70/effects?metric=lv_mass');
  const strokeVolume = useApi('/api/study/cft70/effects?metric=stroke_volume');

  const series = useMemo(() => groupBy(vitals.data ?? [], 'metric_code'), [vitals.data]);
  const daily = useMemo(() => groupBy(history.data ?? [], 'metric_code'), [history.data]);
  const ref = (metric, context = 'any') =>
    reference.data?.ranges.find((r) => r.metric_code === metric && r.context === context);
  const threshold = (metric) => {
    const t = reference.data?.change_thresholds.find((c) => c.metric_code === metric);
    if (!t) return null;
    const sign = t.direction === 'decrease' ? -1 : 1;
    return { warning: sign * t.warning_pct, critical: sign * t.critical_pct };
  };
  const echo = (metric) => (daily[metric] ?? []).map((p) => ({ day: p.mission_day, pct: p.pct }));

  return (
    <Loading state={detail}>
      {({ crew, risk, alerts, episodes_24h: episodes }) => (
        <>
          <div className="page-head">
            <div>
              <button className="back" onClick={onBack}>← Tripulación</button>
              <h1>{crew.crew_code}</h1>
              <div className="facts">
                <span>{ROLE_LABEL[crew.role] ?? crew.role}</span>
                <span><b>{crew.mission_name}</b></span>
                <span>Día <b>{crew.current_mission_day}</b> de {crew.duration_days}</span>
                <span>Gravedad <b>{crew.gravity_g} g</b></span>
                <span>Ejercicio: <b>{crew.countermeasure_hardware}</b></span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Badge level={risk.level} />
              <div className="score">{risk.score}<span className="small muted">/100</span></div>
              <div className="small muted">índice de riesgo</div>
            </div>
          </div>

          <div className="grid-2">
            <Card title="Signos vitales · últimas 24 h" hint="Zona verde = normal · línea roja = crítico">
              <Loading state={vitals}>
                {() => (
                  <div className="grid-charts">
                    <VitalChart title="Frecuencia cardiaca" unit="lpm" points={series.heart_rate ?? []} refRange={ref('heart_rate')} />
                    <BloodPressureChart systolic={series.systolic_bp ?? []} diastolic={series.diastolic_bp ?? []} />
                    <VitalChart title="Saturación de oxígeno" unit="%" points={series.spo2 ?? []} refRange={ref('spo2')}
                      color="var(--series-3)" domain={[88, 100]} />
                    <VitalChart title="Temperatura corporal" unit="°C" points={series.body_temp ?? []} refRange={ref('body_temp')}
                      color="var(--series-2)" domain={[35.5, 40]} />
                  </div>
                )}
              </Loading>
            </Card>

            <div style={{ display: 'grid', gap: 20 }}>
              <Card title="Alertas y acción recomendada" hint={`${alerts.length} activa(s)`}>
                <AlertList alerts={alerts} />
              </Card>
              <Card title="Episodios de las últimas 24 h">
                {episodes.length ? (
                  <table>
                    <thead><tr><th>Señal</th><th>Inicio</th><th className="num">Duración</th><th className="num">Pico</th></tr></thead>
                    <tbody>
                      {episodes.map((e, i) => (
                        <tr key={i}>
                          <td><Badge level={e.level}>{e.metric_name}{e.scope === 'module' ? ' (módulo)' : ''}</Badge></td>
                          <td>{fmtTime(e.start)}</td>
                          <td className="num">{e.duration_min} min</td>
                          <td className="num">{fmt(e.peak, 2)} {e.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="empty">Sin episodios fuera de rango.</p>}
              </Card>
            </div>
          </div>

          <Card title="Ecocardiogramas vs estudio NASA CFT70"
            hint="Línea discontinua: cambio medio en 70 días de reposo en cama (Control sin ejercicio vs Ejercicio B)">
            <Loading state={history}>
              {() => (
                <div className="grid-charts">
                  <EchoTrendChart title="Masa del ventrículo izquierdo" crewSeries={echo('lv_mass')}
                    reference={lvMass.data ?? []} threshold={threshold('lv_mass')} />
                  <EchoTrendChart title="Volumen sistólico" crewSeries={echo('stroke_volume')}
                    reference={strokeVolume.data ?? []} threshold={threshold('stroke_volume')} />
                </div>
              )}
            </Loading>
          </Card>

          <Card title="Tendencias diarias">
            <Loading state={history}>
              {() => (
                <div className="grid-charts">
                  <DailyChart title="FC en reposo" unit="lpm" points={daily.resting_heart_rate ?? []} refRange={ref('resting_heart_rate')} />
                  {daily.hr_orthostatic_increase && (
                    <DailyChart title="FC al ponerse de pie (aumento)" unit="lpm" points={daily.hr_orthostatic_increase}
                      refRange={ref('hr_orthostatic_increase')} color="var(--series-2)" />
                  )}
                  {daily.exercise_minutes && (
                    <DailyChart title="Ejercicio diario (contramedida)" unit="min" points={daily.exercise_minutes}
                      refRange={ref('exercise_minutes')} color="var(--series-3)" />
                  )}
                  <RadiationLimits daily={daily} />
                </div>
              )}
            </Loading>
          </Card>
        </>
      )}
    </Loading>
  );
}

function RadiationLimits({ daily }) {
  const items = [
    ['radiation_dose_30d', '30 días', 250],
    ['radiation_dose_365d', '1 año', 500],
    ['radiation_dose_career', 'Carrera (efectiva)', 600],
  ];
  return (
    <div>
      <div className="card-head"><h3>Radiación acumulada vs límites</h3><span className="hint">NASA-STD-3001</span></div>
      <div style={{ display: 'grid', gap: 12 }}>
        {items.map(([code, label, limit]) => {
          const last = (daily[code] ?? []).at(-1);
          const pct = last ? Math.min(100, (last.value / limit) * 100) : 0;
          const level = last?.status ?? 'normal';
          return (
            <div key={code}>
              <div className="row small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{label}</span><span className="muted">{fmt(last?.value, 1)} / {limit} mSv</span>
              </div>
              <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4 }}>
                <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: `var(--${level})` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function groupBy(rows, key) {
  const out = {};
  for (const r of rows) (out[r[key]] ??= []).push(r);
  return out;
}
