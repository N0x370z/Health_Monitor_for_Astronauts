import { useId } from "react";
import { EVIDENCE } from "../data/evidence.js";
import { STATUS_COLOR } from "../data/config.js";

/* ---------- iconos (SVG inline, sin dependencias) ---------- */
export function Icon({ name, size = 18, color = "currentColor" }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  switch (name) {
    case "logo":
      return (
        <svg {...p} width={size} height={size} viewBox="0 0 32 32" strokeWidth={2.2}>
          <circle cx="16" cy="16" r="8" stroke="var(--cyan)" />
          <ellipse cx="16" cy="16" rx="14" ry="5.5" transform="rotate(-30 16 16)" stroke="var(--blue)" />
          <circle cx="26" cy="9" r="2" fill="var(--cyan)" stroke="none" />
        </svg>
      );
    case "radiation":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="11" fill="var(--yellow)" />
          <g fill="#1b1300">
            <circle cx="12" cy="12" r="2" />
            <path d="M12 12 L8.2 5.4 A7.6 7.6 0 0 1 15.8 5.4 Z" />
            <path d="M12 12 L19.6 12 A7.6 7.6 0 0 1 15.8 18.6 Z" />
            <path d="M12 12 L8.2 18.6 A7.6 7.6 0 0 1 4.4 12 Z" />
          </g>
        </svg>
      );
    case "heart":
      return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path fill="#f43f5e" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4h2c.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" /></svg>;
    case "drop":
      return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path fill="#38bdf8" d="M12 2.5S5 10.2 5 14.6A7 7 0 0 0 19 14.6C19 10.2 12 2.5 12 2.5z" /></svg>;
    case "leaf":
      return <svg {...p} stroke="var(--ok)"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" /><path d="M5 19l7-7" /></svg>;
    case "body": return <svg {...p}><circle cx="12" cy="5" r="2.5" /><path d="M12 8v7M7 10h10M9 22l3-7 3 7" /></svg>;
    case "alert": return <svg {...p}><path d="M12 3l10 18H2z" fill="currentColor" fillOpacity=".15" /><path d="M12 10v5M12 18h.01" /></svg>;
    case "check": return <svg {...p}><circle cx="12" cy="12" r="10" fill="var(--ok)" stroke="none" /><path d="M7.5 12.5l3 3 6-6" stroke="#04122b" strokeWidth="2.6" /></svg>;
    case "signal": return <svg {...p}><path d="M4 20v-3M9 20v-6M14 20v-9M19 20V5" /></svg>;
    case "suit": return <svg {...p}><circle cx="12" cy="8" r="5" /><rect x="9.5" y="6.5" width="5" height="3" rx="1" /><path d="M6 21v-5a6 6 0 0 1 12 0v5" /></svg>;
    case "chart": return <svg {...p}><path d="M3 20h18M6 16l4-5 3 3 5-7" /></svg>;
    case "pen": return <svg {...p}><path d="M4 20l4-1 11-11-3-3L5 16z" /></svg>;
    case "send": return <svg {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>;
    case "shield": return <svg {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>;
    case "book": return <svg {...p}><path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" /><path d="M8 8h6" /></svg>;
    default: return null;
  }
}

export const Dot = ({ status }) => <span className={`dot ${status}`} aria-label={status} />;

export function Card({ title, icon, sub, right, status, children, onClick, style, className = "" }) {
  return (
    <section className={`card ${onClick ? "clickable" : ""} ${status === "warn" ? "state-warn" : status === "crit" ? "state-crit" : ""} ${className}`} onClick={onClick} style={style}>
      {(title || right) && (
        <div className="card-head">
          <div className="card-title">{icon}{title}{sub && <span className="card-sub">· {sub}</span>}</div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- sparkline ---------- */
export function Sparkline({ data, color = "var(--cyan)", height = 44, min, max, threshold }) {
  const id = useId();
  if (!data?.length) return null;
  const lo = min ?? Math.min(...data);
  const hi = max ?? Math.max(...data);
  const span = hi - lo || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * 100, 30 - ((v - lo) / span) * 26 - 2]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const ty = threshold != null ? 30 - ((threshold - lo) / span) * 26 - 2 : null;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L100,30 L0,30 Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      {ty != null && ty > 0 && ty < 30 && <line x1="0" x2="100" y1={ty} y2={ty} stroke="var(--crit)" strokeDasharray="2 2" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".7" />}
    </svg>
  );
}

/* ---------- gauge radial (diseño 3) — escala logarítmica para radiación ---------- */
export function RadialGauge({ value, min = 5, max = 2000, status = "ok", label, unit, size = 190 }) {
  const id = useId();
  const f = Math.max(0, Math.min(1, (Math.log10(Math.max(value, min)) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))));
  const r = 80, cx = 100, cy = 100, start = 135, sweep = 270;
  const pt = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const arc = (a0, a1) => {
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1}`;
  };
  const end = start + sweep * f;
  const col = STATUS_COLOR[status];
  return (
    <svg viewBox="0 0 200 175" width={size} style={{ maxWidth: "100%" }} role="img" aria-label={`${label} ${value}`}>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor="var(--teal)" />
          <stop offset="1" stopColor={status === "ok" ? "var(--cyan)" : col} />
        </linearGradient>
      </defs>
      <path d={arc(start, start + sweep)} stroke="rgba(255,255,255,.08)" strokeWidth="14" fill="none" strokeLinecap="round" />
      {f > 0.001 && <path d={arc(start, end)} stroke={`url(#${id})`} strokeWidth="14" fill="none" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${col})`, transition: "all .6s" }} />}
      <text x="100" y="98" textAnchor="middle" fill="var(--text)" style={{ font: "700 36px var(--font-display)" }}>{value >= 100 ? Math.round(value) : value.toFixed(1)}</text>
      <text x="100" y="122" textAnchor="middle" fill="var(--text-2)" style={{ font: "600 14px var(--font-body)" }}>{unit}</text>
    </svg>
  );
}

/* ---------- anillo (SpO2) ---------- */
export function Ring({ value, min = 85, max = 100, color = "var(--cyan)", size = 64 }) {
  const f = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      <circle cx="32" cy="32" r={r} stroke="rgba(255,255,255,.08)" strokeWidth="7" fill="none" />
      <circle cx="32" cy="32" r={r} stroke={color} strokeWidth="7" fill="none" strokeLinecap="round"
        strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 32 32)" style={{ transition: "stroke-dasharray .6s", filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

/* ---------- barra de nivel ---------- */
export function Level({ value, min, max, status }) {
  const f = Math.max(0.03, Math.min(1, (value - min) / (max - min)));
  return <div className="level"><i style={{ width: `${f * 100}%`, background: STATUS_COLOR[status] }} /></div>;
}

/* ---------- evidencia NLSP ---------- */
export function Evidence({ keys = [] }) {
  const items = keys.map((k) => EVIDENCE[k]).filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="evidence">
      <Icon name="book" size={14} />
      <div>
        Based on NASA NLSP:{" "}
        {items.map((e, i) => (
          <span key={e.id}>
            {i > 0 && " · "}
            <a href={e.url} target="_blank" rel="noreferrer" title={e.title}>{e.id}</a> <span className="muted">({e.mission})</span>
          </span>
        ))}
      </div>
    </div>
  );
}
