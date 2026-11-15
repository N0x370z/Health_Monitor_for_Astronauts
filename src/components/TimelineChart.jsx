import { TIMEPOINTS } from "../data/echo.js";
import { delta } from "../sim/heart.js";

// Gráfica ancha (parte inferior de la pantalla de referencia): % de cambio vs Pre por métrica a lo largo del estudio.
const SERIES = [
  { k: "lvMass", label: "LV mass", color: "#16a34a", group: "size" },
  { k: "edv", label: "LVEDV", color: "#0891b2", group: "size" },
  { k: "sv", label: "Stroke vol.", color: "#7c3aed", group: "flow" },
  { k: "vti", label: "LVOT VTI", color: "#d97706", group: "flow" },
  { k: "hr", label: "Heart rate", color: "#e11d48", group: "flow" },
];

export default function TimelineChart({ subject, tpKey, onSelect, height = 300, mode = "all" }) {
  const W = 440, H = 260, L = 38, R = 10, T = 20, B = 30;
  const xs = (i) => L + (i / (TIMEPOINTS.length - 1)) * (W - L - R);
  const data = SERIES.filter((s) => mode === "all" || s.group === mode).map((s) => ({
    ...s,
    pts: TIMEPOINTS.map((t, i) => ({ i, d: delta(subject.tp[t.key]?.[s.k], subject.tp.pre?.[s.k]) })).filter((p) => p.d != null),
  }));
  const all = data.flatMap((s) => s.pts.map((p) => p.d));
  const lo = Math.min(-20, Math.floor(Math.min(...all, 0) / 10) * 10);
  const hi = Math.max(20, Math.ceil(Math.max(...all, 0) / 10) * 10);
  const ys = (d) => T + ((hi - d) / (hi - lo)) * (H - T - B);
  const ticks = [];
  for (let v = lo; v <= hi; v += 10) ticks.push(v);
  const cur = TIMEPOINTS.findIndex((t) => t.key === tpKey);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxHeight: height }} role="img" aria-label="Change vs baseline over the study">
        {/* zona de microgravedad (reposo en cama) */}
        <rect x={xs(1) - 10} y={T} width={xs(4) - xs(1) + 20} height={H - T - B} fill="var(--band)" />
        <text x={(xs(1) + xs(4)) / 2} y={T + 10} textAnchor="middle" fill="var(--text-3)" style={{ font: "700 10px var(--font-display)", letterSpacing: ".08em" }}>BED REST · MICROGRAVITY ANALOG</text>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={ys(v)} y2={ys(v)} stroke={v === 0 ? "var(--grid-strong)" : "var(--grid)"} vectorEffect="non-scaling-stroke" />
            <text x={L - 6} y={ys(v) + 3} textAnchor="end" fill="var(--text-3)" style={{ font: "600 11px var(--font-body)" }}>{v > 0 ? "+" : ""}{v}%</text>
          </g>
        ))}
        <line x1={xs(cur)} x2={xs(cur)} y1={T} y2={H - B} stroke="var(--primary-2)" strokeWidth="2" strokeDasharray="4 4" opacity=".8" vectorEffect="non-scaling-stroke" />
        {data.map((s) => (
          <g key={s.k}>
            <polyline points={s.pts.map((p) => `${xs(p.i)},${ys(p.d)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            {s.pts.map((p) => <circle key={p.i} cx={xs(p.i)} cy={ys(p.d)} r={p.i === cur ? 4.5 : 3} fill={s.color} stroke="#fff" strokeWidth="1.5" />)}
          </g>
        ))}
        {TIMEPOINTS.map((t, i) => (
          <g key={t.key} onClick={() => onSelect(t.key)} style={{ cursor: "pointer" }}>
            <rect x={xs(i) - 22} y={T} width="44" height={H - T} fill="transparent" />
            <text x={xs(i)} y={H - 10} textAnchor="middle" fill={i === cur ? "var(--primary)" : "var(--text-3)"} style={{ font: `${i === cur ? 700 : 600} 12px var(--font-display)` }}>{t.label}</text>
          </g>
        ))}
      </svg>
      <div className="legend">
        {data.map((s) => <span key={s.k}><i style={{ background: s.color }} />{s.label}</span>)}
        <span className="muted">% change vs pre bed rest · click a timepoint</span>
      </div>
    </div>
  );
}
