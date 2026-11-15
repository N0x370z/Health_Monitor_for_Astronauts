import {
  CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fmt, fmtTime } from '../format.js';

const AXIS = { stroke: 'var(--muted)', fontSize: 11, tickLine: false };
const TOOLTIP = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'var(--muted)' },
};

/** Bandas de referencia: zona normal sombreada y límites críticos punteados. */
function bands(ref) {
  if (!ref) return null;
  return [
    ref.normal_min != null && ref.normal_max != null && (
      <ReferenceArea key="n" y1={ref.normal_min} y2={ref.normal_max} fill="var(--normal)" fillOpacity={0.07} ifOverflow="extendDomain" />
    ),
    ref.critical_low != null && <ReferenceLine key="cl" y={ref.critical_low} stroke="var(--critical)" strokeDasharray="4 4" />,
    ref.critical_high != null && <ReferenceLine key="ch" y={ref.critical_high} stroke="var(--critical)" strokeDasharray="4 4" />,
  ];
}

function StatusDot({ cx, cy, payload }) {
  if (!payload || payload.status === 'normal' || payload.activity === 'exercise') return null;
  return <circle cx={cx} cy={cy} r={2.5} fill={payload.status === 'critical' ? 'var(--critical)' : 'var(--warning)'} />;
}

/** Serie de 24 h de un signo vital con su rango de referencia. */
export function VitalChart({ title, points, refRange, unit, color = 'var(--series-1)', domain = ['auto', 'auto'] }) {
  return (
    <div>
      <div className="card-head"><h3>{title}</h3><span className="hint">{unit}</span></div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          {bands(refRange)}
          <XAxis dataKey="ts" tickFormatter={fmtTime} minTickGap={50} {...AXIS} />
          <YAxis domain={domain} {...AXIS} />
          <Tooltip {...TOOLTIP} labelFormatter={fmtTime} formatter={(v) => [`${fmt(v, 2)} ${unit}`, title]} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.4} dot={<StatusDot />} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Presión arterial sistólica y diastólica en la misma gráfica. */
export function BloodPressureChart({ systolic, diastolic }) {
  const byTs = new Map(systolic.map((p) => [p.ts, { ts: p.ts, sys: p.value, status: p.status, activity: p.activity }]));
  for (const p of diastolic) byTs.set(p.ts, { ...(byTs.get(p.ts) ?? { ts: p.ts }), dia: p.value });
  return (
    <div>
      <div className="card-head"><h3>Presión arterial</h3><span className="hint">mmHg</span></div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={[...byTs.values()]} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <ReferenceLine y={130} stroke="var(--warning)" strokeDasharray="4 4" />
          <ReferenceLine y={80} stroke="var(--warning)" strokeDasharray="4 4" />
          <XAxis dataKey="ts" tickFormatter={fmtTime} minTickGap={50} {...AXIS} />
          <YAxis domain={['auto', 'auto']} {...AXIS} />
          <Tooltip {...TOOLTIP} labelFormatter={fmtTime} />
          <Line type="monotone" dataKey="sys" name="Sistólica" stroke="var(--series-1)" strokeWidth={1.4} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="dia" name="Diastólica" stroke="var(--series-2)" strokeWidth={1.4} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Tendencia de ecocardiogramas del tripulante (% vs línea base) comparada con
 * los grupos Control y con ejercicio del estudio CFT70 (mismos días de reposo).
 */
export function EchoTrendChart({ title, crewSeries, reference, threshold }) {
  const days = new Map();
  for (const p of crewSeries) days.set(p.day, { day: p.day, crew: p.pct });
  for (const r of reference) {
    if (!r.timepoint_code.startsWith('BR')) continue; // solo durante el reposo (sin R+0 / R+3)
    const day = Math.max(0, Math.round(r.day_offset));
    days.set(day, { ...(days.get(day) ?? { day }), [r.group_code]: r.mean_pct_change });
  }
  const data = [...days.values()].sort((a, b) => a.day - b.day);
  const maxDay = Math.max(75, ...crewSeries.map((p) => p.day));
  return (
    <div>
      <div className="card-head"><h3>{title}</h3><span className="hint">% vs línea base</span></div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <ReferenceLine y={0} stroke="var(--muted)" />
          {threshold && <ReferenceLine y={threshold.warning} stroke="var(--warning)" strokeDasharray="4 4" />}
          {threshold && <ReferenceLine y={threshold.critical} stroke="var(--critical)" strokeDasharray="4 4" />}
          <XAxis dataKey="day" type="number" domain={[0, maxDay]} {...AXIS} />
          <YAxis {...AXIS} />
          <Tooltip {...TOOLTIP} labelFormatter={(d) => `Día ${d}`} formatter={(v, n) => [`${fmt(v, 1)} %`, n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="CONTROL" name="CFT70 Control" stroke="var(--critical)" strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
          <Line dataKey="EXERCISE_B" name="CFT70 Ejercicio B" stroke="var(--normal)" strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
          <Line dataKey="crew" name="Tripulante" stroke="var(--series-1)" strokeWidth={2.2} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Serie diaria simple (FC en reposo, pruebas ortostáticas). */
export function DailyChart({ title, points, unit, refRange, color = 'var(--series-1)' }) {
  return (
    <div>
      <div className="card-head"><h3>{title}</h3><span className="hint">{unit}</span></div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          {bands(refRange)}
          <XAxis dataKey="mission_day" type="number" domain={['dataMin', 'dataMax']} {...AXIS} />
          <YAxis domain={['auto', 'auto']} {...AXIS} />
          <Tooltip {...TOOLTIP} labelFormatter={(d) => `Día ${d}`} formatter={(v) => [`${fmt(v, 1)} ${unit}`, title]} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.6} dot={<StatusDot />} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gráfica del estudio: cambio medio por grupo a lo largo de los momentos del reposo en cama. */
export function StudyChart({ rows, unitLabel }) {
  const byTp = new Map();
  for (const r of rows) {
    const p = byTp.get(r.timepoint_code) ?? { tp: r.timepoint_code, order: r.sort_order };
    p[r.group_code] = r.mean_pct_change;
    byTp.set(r.timepoint_code, p);
  }
  const data = [...byTp.values()].sort((a, b) => a.order - b.order);
  const groups = [
    ['CONTROL', 'Control (sin ejercicio)', 'var(--critical)'],
    ['EXERCISE_A', 'Ejercicio A', 'var(--series-1)'],
    ['EXERCISE_B', 'Ejercicio B', 'var(--series-2)'],
    ['FLYWHEEL', 'Flywheel', 'var(--series-3)'],
  ];
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <ReferenceLine y={0} stroke="var(--muted)" />
        <XAxis dataKey="tp" {...AXIS} />
        <YAxis {...AXIS} label={{ value: unitLabel, angle: -90, position: 'insideLeft', fill: 'var(--muted)', fontSize: 11, dx: 14 }} />
        <Tooltip {...TOOLTIP} formatter={(v, n) => [`${fmt(v, 1)} %`, n]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {groups.map(([code, name, color]) => (
          <Line key={code} dataKey={code} name={name} stroke={color} strokeWidth={code === 'CONTROL' ? 2.6 : 1.8}
            dot={{ r: 3 }} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
