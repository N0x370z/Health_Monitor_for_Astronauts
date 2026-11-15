import { cloneElement } from "react";
import { STATUS_COLOR, STATUS_LABEL } from "../../domain/config.js";

// Corazón holográfico (gradiente verde→azul como la pantalla de referencia) con cámaras clicables.
// Late al ritmo cardíaco medido del sujeto.
const SPOTS = {
  aortic: { x: 196, y: 70, side: "right", ly: 40, label: "Aortic outflow" },
  mitral: { x: 214, y: 156, side: "right", ly: 140, label: "Mitral valve" },
  lv: { x: 222, y: 246, side: "right", ly: 262, label: "Left ventricle" },
  rhythm: { x: 92, y: 146, side: "left", ly: 112, label: "Rate & timing" },
  rv: { x: 126, y: 236, side: "left", ly: 240, label: "Right ventricle" },
};

const BODY = "M118 120 C80 128 58 165 62 210 C66 255 112 298 196 332 C238 292 268 246 266 196 C264 150 236 118 196 116 C178 115 162 118 150 124 C140 120 130 118 118 120 Z";
const AORTA = "M146 126 C144 92 148 60 172 46 C196 32 230 40 236 68 L216 72 C212 58 196 54 186 62 C174 72 172 98 174 122 Z";
const PULM = "M126 124 C118 98 112 82 96 72 L84 86 C98 96 104 110 106 126 Z";
const SVC = "M76 160 L72 88 L92 88 L96 150 Z";
const REGIONS = {
  lv: <ellipse cx="214" cy="236" rx="46" ry="72" transform="rotate(-18 214 236)" />,
  rv: <ellipse cx="126" cy="222" rx="50" ry="64" transform="rotate(14 126 222)" />,
  mitral: <ellipse cx="212" cy="158" rx="30" ry="20" />,
  aortic: <path d={AORTA} />,
  rhythm: <ellipse cx="90" cy="168" rx="30" ry="38" />,
};

export default function Heart({ chambers, selected, onSelect, hr }) {
  const by = Object.fromEntries(chambers.map((c) => [c.key, c]));
  const beat = hr ? Math.max(0.35, Math.min(1.6, 60 / hr)) : 0.9;
  return (
    <svg viewBox="-44 0 408 360" width="100%" style={{ maxHeight: 440, display: "block", margin: "0 auto" }} role="group" aria-label="Heart chambers">
      <defs>
        <linearGradient id="hFill" x1="0" x2="0.4" y1="0" y2="1">
          <stop offset="0" stopColor="#4ade80" stopOpacity=".55" />
          <stop offset=".55" stopColor="#22d3ee" stopOpacity=".35" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity=".25" />
        </linearGradient>
        <linearGradient id="vFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f87171" stopOpacity=".45" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity=".3" />
        </linearGradient>
        <linearGradient id="hScan" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset=".5" stopColor="#a7f3d0" stopOpacity=".55" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
        <filter id="hGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <pattern id="hMesh" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" fill="none" stroke="rgba(167,243,208,.16)" strokeWidth=".5" />
        </pattern>
        <clipPath id="hClip"><path d={BODY} /><path d={AORTA} /><path d={PULM} /><path d={SVC} /><ellipse cx="226" cy="140" rx="34" ry="24" /><ellipse cx="88" cy="168" rx="30" ry="38" /></clipPath>
        <filter id="hSel" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* plataforma */}
      <ellipse cx="164" cy="346" rx="90" ry="9" fill="none" stroke="rgba(34,211,238,.35)" />
      <ellipse cx="164" cy="346" rx="60" ry="5" fill="rgba(74,222,128,.16)" />

      <g className="heart-beat" style={{ animationDuration: `${beat}s` }}>
        {/* vasos */}
        <g filter="url(#hGlow)" stroke="#86efac" strokeWidth="1.3" strokeLinejoin="round">
          <path d={SVC} fill="url(#vFill)" />
          <path d={PULM} fill="url(#vFill)" />
          <path d={AORTA} fill="url(#vFill)" />
          {[[180, 46, 176, 16], [198, 38, 198, 10], [216, 44, 222, 16]].map(([x1, y1, x2, y2]) => (
            <path key={x1} d={`M${x1 - 5} ${y1} L${x2 - 5} ${y2} L${x2 + 5} ${y2} L${x1 + 5} ${y1}`} fill="url(#vFill)" />
          ))}
          <ellipse cx="226" cy="140" rx="34" ry="24" fill="url(#hFill)" />
          <ellipse cx="88" cy="168" rx="30" ry="38" fill="url(#hFill)" />
          <path d={BODY} fill="url(#hFill)" />
        </g>

        <g clipPath="url(#hClip)" pointerEvents="none">
          <rect x="40" y="0" width="240" height="340" fill="url(#hMesh)" />
          {/* regiones con estado */}
          {Object.entries(REGIONS).map(([k, shape]) => {
            const s = by[k]?.status;
            if (!s || s === "ok" || s === "none") return null;
            return <g key={k} fill={STATUS_COLOR[s]} opacity={selected === k ? 0.35 : 0.22}>{shape}</g>;
          })}
          {/* contorno iluminado de la zona tocada */}
          {selected && REGIONS[selected] && (
            <g key={selected} className="heart-sel">
              {cloneElement(REGIONS[selected], { fill: "rgba(255,255,255,.16)", stroke: "none" })}
              {cloneElement(REGIONS[selected], { fill: "none", stroke: "#ffffff", strokeWidth: 3, filter: "url(#hSel)" })}
              {cloneElement(REGIONS[selected], { fill: "none", stroke: STATUS_COLOR[by[selected]?.status ?? "ok"], strokeWidth: 1.5 })}
            </g>
          )}
          {/* surcos y coronarias */}
          <g fill="none" stroke="rgba(167,243,208,.45)" strokeWidth="1">
            <path d="M166 128 C170 196 178 262 196 330" />
            <path d="M150 140 C120 170 104 210 110 262" strokeDasharray="3 4" />
            <path d="M184 150 C214 180 236 220 238 260" strokeDasharray="3 4" />
            <path d="M120 160 C150 168 180 168 214 160" />
          </g>
          <rect x="40" y="-30" width="240" height="26" fill="url(#hScan)">
            <animate attributeName="y" values="-30;340;-30" dur="6s" repeatCount="indefinite" />
          </rect>
        </g>
      </g>

      {Object.entries(SPOTS).map(([k, p]) => {
        const c = by[k];
        if (!c) return null;
        const col = STATUS_COLOR[c.status];
        const sel = selected === k;
        const left = p.side === "left";
        const lx = left ? -40 : 360;
        const elbow = left ? 52 : 272;
        return (
          <g key={k} onClick={() => onSelect(k)} style={{ cursor: "pointer" }} role="button" tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(k)} aria-label={`${p.label}: ${STATUS_LABEL[c.status]}`}>
            <path d={`M${p.x} ${p.y} L${elbow} ${p.ly + 6} L${left ? lx + 82 : lx - 82} ${p.ly + 6}`} fill="none" stroke={col} strokeOpacity={sel ? 0.95 : 0.5} strokeWidth="1" />
            <text x={lx} y={p.ly} textAnchor={left ? "start" : "end"} fill="var(--text)" style={{ font: "600 15px var(--font-body)" }}>{p.label}</text>
            <text x={lx} y={p.ly + 20} textAnchor={left ? "start" : "end"} fill={c.score == null ? "#fda29b" : col} style={{ font: "700 11px var(--font-display)", letterSpacing: ".06em" }}>
              {c.score == null ? "ERROR · NO DATA" : `${STATUS_LABEL[c.status].toUpperCase()} · ${c.score}`}
            </text>
            <circle cx={p.x} cy={p.y} r="12" fill={col} opacity=".22">
              <animate attributeName="r" values="8;14;8" dur={c.status === "crit" ? "0.8s" : "2.4s"} repeatCount="indefinite" />
            </circle>
            <circle cx={p.x} cy={p.y} r="5" fill={col} stroke="#fff" strokeWidth={sel ? 2 : 1} style={{ filter: `drop-shadow(0 0 6px ${col})` }} />
            <rect x={left ? lx - 4 : lx - 92} y={p.ly - 14} width="96" height="36" fill="transparent" />
            <circle cx={p.x} cy={p.y} r="18" fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}
