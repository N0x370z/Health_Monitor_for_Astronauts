import { useId } from "react";
import { SOURCES } from "../../data/echo.js";
import { STATUS_COLOR } from "../../domain/config.js";

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
    case "calendar": return <svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
    case "bell": return <svg {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>;
    case "activity": return <svg {...p}><path d="M3 12h4l2.5-6 5 12 2.5-6h4" /></svg>;
    case "dumbbell": return <svg {...p}><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></svg>;
    case "bulb": return <svg {...p}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>;
    case "list": return <svg {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></svg>;
    case "chevronL": return <svg {...p}><path d="M15 6l-6 6 6 6" /></svg>;
    case "arrowR": return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case "arrowUp": return <svg {...p}><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
    case "arrowDown": return <svg {...p}><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
    case "user": return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case "brandHeart":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
          <path d="M24 42S5 30.5 5 17.5C5 11 9.8 6.5 15.5 6.5c3.9 0 6.8 2.1 8.5 4.8 1.7-2.7 4.6-4.8 8.5-4.8C38.2 6.5 43 11 43 17.5 43 30.5 24 42 24 42z" fill="#3b82f6" />
          <path d="M24 42S5 30.5 5 17.5C5 11 9.8 6.5 15.5 6.5c3.9 0 6.8 2.1 8.5 4.8" fill="none" stroke="#93c5fd" strokeWidth="1.5" opacity=".6" />
          <path d="M6 24h10l3-6 5 12 4-9 2.5 3H42" fill="none" stroke="#0f2747" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "heartLine": return <svg {...p}><path d="M12 20s-7.5-4.6-9-9.4C2 7 4.2 4.5 7.2 4.5c2 0 3.6 1.2 4.8 2.8 1.2-1.6 2.8-2.8 4.8-2.8 3 0 5.2 2.5 4.2 6.1C19.5 15.4 12 20 12 20z" /></svg>;
    case "water": return <svg {...p}><path d="M6 3h12l-1.5 17.5a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M6.6 10h10.8" /></svg>;
    case "run": return <svg {...p}><circle cx="14.5" cy="4.5" r="2" /><path d="M8 21l3.5-6 3 2.5V22M6 11.5l3.5-3h4l2.5 3.5 3 1M11.5 8.5l-1.5 6" /></svg>;
    case "stetho": return <svg {...p}><path d="M5 3v6a5 5 0 0 0 10 0V3" /><path d="M10 14v2a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="12" r="2" /></svg>;
    case "pill": return <svg {...p}><rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-40 12 12)" /><path d="M9.5 9.5l5 5" /></svg>;
    case "dice": return <svg {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><circle cx="8.5" cy="8.5" r="1.2" fill={color} /><circle cx="15.5" cy="8.5" r="1.2" fill={color} /><circle cx="12" cy="12" r="1.2" fill={color} /><circle cx="8.5" cy="15.5" r="1.2" fill={color} /><circle cx="15.5" cy="15.5" r="1.2" fill={color} /></svg>;
    case "database": return <svg {...p}><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></svg>;
    case "play": return <svg {...p} stroke="none"><path d="M7 4.5v15l12.5-7.5z" fill={color} /></svg>;
    case "pause": return <svg {...p} stroke="none"><rect x="6" y="4.5" width="4" height="15" rx="1" fill={color} /><rect x="14" y="4.5" width="4" height="15" rx="1" fill={color} /></svg>;
    case "close": return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case "chevron": return <svg {...p}><path d="M9 6l6 6-6 6" /></svg>;
    case "reset": return <svg {...p}><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v4.5h4.5" /></svg>;
    case "tick": return <svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
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

/* ---------- error: la base de datos no tiene este dato ---------- */
export function NoData({ what, compact = false }) {
  return (
    <div className={`nodata ${compact ? "compact" : ""}`} role="status">
      <Icon name="alert" size={compact ? 14 : 18} />
      <div>
        <b>Error · no data in database</b>
        {what && <span>{what}</span>}
      </div>
    </div>
  );
}

/* ---------- fuente de datos ---------- */
export function Evidence({ keys = [] }) {
  const items = keys.map((k) => SOURCES[k]).filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="evidence">
      <Icon name="book" size={14} />
      <div>
        Data:{" "}
        {items.map((e, i) => (
          <span key={e.id}>{i > 0 && " · "}<b style={{ color: "var(--cyan)", fontWeight: 600 }}>{e.id}</b> <span className="muted">({e.detail})</span></span>
        ))}
      </div>
    </div>
  );
}
