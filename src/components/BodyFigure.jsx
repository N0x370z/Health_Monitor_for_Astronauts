import { STATUS_COLOR, STATUS_LABEL } from "../data/config.js";

// Silueta holográfica (diseños 2/3) con sistemas clicables y etiquetas con línea guía.
const SPOTS = {
  mind: { x: 140, y: 40, side: "left", ly: 34, label: "Mind & Sleep" },
  brain: { x: 160, y: 56, side: "right", ly: 52, label: "Brain / Eyes" },
  heart: { x: 161, y: 134, side: "right", ly: 128, label: "Heart" },
  immune: { x: 140, y: 182, side: "left", ly: 178, label: "Immune" },
  bones: { x: 131, y: 300, side: "left", ly: 296, label: "Bones & Muscles" },
};

const TORSO = "M112 100 Q150 90 188 100 Q197 105 198 118 L194 170 Q190 202 184 222 Q170 238 150 240 Q130 238 116 222 Q110 202 106 170 L102 118 Q103 105 112 100 Z";
const ARM_L = "M108 102 Q88 104 84 126 L78 178 L70 246 Q68 262 77 265 Q86 264 86 250 L95 186 L104 140 Z";
const ARM_R = "M192 102 Q212 104 216 126 L222 178 L230 246 Q232 262 223 265 Q214 264 214 250 L205 186 L196 140 Z";
const LEG_L = "M117 226 Q113 290 117 332 L119 402 Q119 414 131 414 L141 414 Q146 410 144 401 L146 332 Q150 292 148 238 Z";
const LEG_R = "M183 226 Q187 290 183 332 L181 402 Q181 414 169 414 L159 414 Q154 410 156 401 L154 332 Q150 292 152 238 Z";

export default function BodyFigure({ systems, selected, onSelect }) {
  const byKey = Object.fromEntries(systems.map((s) => [s.key, s]));
  const heartCol = STATUS_COLOR[byKey.heart?.status ?? "ok"];
  return (
    <svg viewBox="0 0 300 440" width="100%" style={{ maxHeight: 470, display: "block", margin: "0 auto" }} role="group" aria-label="Body systems">
      <defs>
        <linearGradient id="bodyFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5fb4ff" stopOpacity=".42" />
          <stop offset=".6" stopColor="#2563eb" stopOpacity=".2" />
          <stop offset="1" stopColor="#1d4ed8" stopOpacity=".08" />
        </linearGradient>
        <radialGradient id="core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".25" stopColor={heartCol} stopOpacity=".8" />
          <stop offset="1" stopColor={heartCol} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="scan" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset=".5" stopColor="#22d3ee" stopOpacity=".55" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <pattern id="mesh" width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M7 0H0V7" fill="none" stroke="rgba(140,200,255,.16)" strokeWidth=".5" />
        </pattern>
        <clipPath id="bodyClip">
          <ellipse cx="150" cy="52" rx="24" ry="29" />
          <path d="M140 76 L140 96 L160 96 L160 76 Z" />
          <path d={TORSO} /><path d={ARM_L} /><path d={ARM_R} /><path d={LEG_L} /><path d={LEG_R} />
        </clipPath>
      </defs>

      {/* plataforma holográfica */}
      <ellipse cx="150" cy="420" rx="78" ry="10" fill="none" stroke="rgba(34,211,238,.35)" />
      <ellipse cx="150" cy="420" rx="52" ry="6" fill="rgba(34,211,238,.16)" />
      <ellipse cx="150" cy="420" rx="96" ry="13" fill="none" stroke="rgba(59,130,246,.18)" strokeDasharray="3 5" />

      {/* cuerpo */}
      <g filter="url(#glow)" stroke="#6cc9ff" strokeWidth="1.3" fill="url(#bodyFill)" strokeLinejoin="round">
        <path d={LEG_L} /><path d={LEG_R} /><path d={ARM_L} /><path d={ARM_R} />
        <path d="M140 76 Q141 90 133 97 L167 97 Q159 90 160 76" />
        <path d={TORSO} />
        <ellipse cx="150" cy="52" rx="24" ry="29" />
      </g>

      <g clipPath="url(#bodyClip)" pointerEvents="none">
        <rect x="60" y="0" width="180" height="420" fill="url(#mesh)" />
        {/* esqueleto tenue */}
        <g stroke="rgba(170,225,255,.32)" strokeWidth=".8" fill="none">
          <path d="M150 88 L150 232" />
          {[112, 122, 132, 142, 152].map((y, i) => <path key={y} d={`M${124 + i * 1.5} ${y} Q150 ${y + 7} ${176 - i * 1.5} ${y}`} />)}
          <path d="M126 222 Q150 206 174 222" />
          <path d="M131 250 L132 330 M169 250 L168 330 M132 340 L134 400 M168 340 L166 400" />
          <path d="M96 130 L88 200 M204 130 L212 200" />
        </g>
        {/* línea de escaneo */}
        <rect x="60" y="-20" width="180" height="22" fill="url(#scan)">
          <animate attributeName="y" values="-20;420;-20" dur="7s" repeatCount="indefinite" />
        </rect>
      </g>

      {/* núcleo del corazón */}
      <circle cx="161" cy="134" r="16" fill="url(#core)" pointerEvents="none">
        <animate attributeName="r" values="13;17;13" dur="1.1s" repeatCount="indefinite" />
      </circle>

      {/* puntos + etiquetas */}
      {Object.entries(SPOTS).map(([k, p]) => {
        const s = byKey[k];
        if (!s) return null;
        const col = STATUS_COLOR[s.status];
        const sel = selected === k;
        const left = p.side === "left";
        const lx = left ? 8 : 292;
        const elbow = left ? 100 : 200;
        return (
          <g key={k} onClick={() => onSelect(k)} style={{ cursor: "pointer" }} role="button" tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(k)} aria-label={`${p.label}: ${STATUS_LABEL[s.status]}`}>
            <path d={`M${p.x} ${p.y} L${elbow} ${p.ly + 6} L${left ? lx + 84 : lx - 84} ${p.ly + 6}`} fill="none" stroke={col} strokeOpacity={sel ? 0.9 : 0.45} strokeWidth="1" />
            <text x={lx} y={p.ly} textAnchor={left ? "start" : "end"} fill="var(--text)" style={{ font: "600 11px var(--font-body)" }}>{p.label}</text>
            <text x={lx} y={p.ly + 17} textAnchor={left ? "start" : "end"} fill={col} style={{ font: "700 9px var(--font-display)", letterSpacing: ".08em" }}>{STATUS_LABEL[s.status].toUpperCase()}</text>
            <circle cx={p.x} cy={p.y} r="12" fill={col} opacity=".2">
              <animate attributeName="r" values="9;14;9" dur={s.status === "crit" ? "0.8s" : "2.6s"} repeatCount="indefinite" />
            </circle>
            <circle cx={p.x} cy={p.y} r="5" fill={col} stroke="#fff" strokeWidth={sel ? 2 : 1} style={{ filter: `drop-shadow(0 0 6px ${col})` }} />
            <rect x={left ? lx - 4 : lx - 92} y={p.ly - 14} width="96" height="36" fill="transparent" />
            <circle cx={p.x} cy={p.y} r="16" fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}
