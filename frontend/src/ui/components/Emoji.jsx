// Emojis dibujados como SVG: se ven igual en cualquier sistema operativo y funcionan offline.
import { useId } from "react";

function Face({ mouth, brows, cheeks, size, label, tint = ["#fde68a", "#f59e0b"] }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label={label}>
      <defs>
        <radialGradient id={id} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor={tint[0]} />
          <stop offset="1" stopColor={tint[1]} />
        </radialGradient>
      </defs>
      <circle cx="18" cy="18" r="16" fill={`url(#${id})`} />
      <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(0,0,0,.12)" />
      {cheeks && <><circle cx="9.5" cy="21" r="2.6" fill="#fb7185" opacity=".45" /><circle cx="26.5" cy="21" r="2.6" fill="#fb7185" opacity=".45" /></>}
      <ellipse cx="12.5" cy="15" rx="2" ry="2.6" fill="#3b2508" />
      <ellipse cx="23.5" cy="15" rx="2" ry="2.6" fill="#3b2508" />
      {brows}
      <path d={mouth} fill="none" stroke="#3b2508" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function MoodFace({ level, size = 30 }) {
  const L = ["Very low", "Low", "Neutral", "Good", "Great"][level - 1];
  switch (level) {
    case 1:
      return <Face size={size} label={L} tint={["#bfdbfe", "#60a5fa"]} mouth="M11 26 Q18 20 25 26"
        brows={<><path d="M9 11 L15 9.5" stroke="#3b2508" strokeWidth="1.8" strokeLinecap="round" /><path d="M27 11 L21 9.5" stroke="#3b2508" strokeWidth="1.8" strokeLinecap="round" /></>} />;
    case 2:
      return <Face size={size} label={L} tint={["#fef3c7", "#fbbf24"]} mouth="M12 25 Q18 21.5 24 24" />;
    case 3:
      return <Face size={size} label={L} mouth="M12.5 24 L23.5 24" />;
    case 4:
      return <Face size={size} label={L} mouth="M11.5 22.5 Q18 28 24.5 22.5" />;
    default:
      return <Face size={size} label={L} cheeks mouth="M11 21 Q18 30 25 21" tint={["#fef08a", "#f59e0b"]} />;
  }
}

export function Emoji({ name, size = 18 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", role: "img", "aria-label": name, style: { flex: "none", verticalAlign: "-0.2em" } };
  switch (name) {
    case "flame":
      return (
        <svg {...p}>
          <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z" fill="#f97316" />
          <path d="M12 11c.6 2 3 3 3 6a3 3 0 0 1-6 0c0-1.6 1-2.6 1.8-3 0 1 .4 1.6 1 1.6 0-2-.4-3 .2-4.6z" fill="#fde047" />
        </svg>
      );
    case "satellite":
      return (
        <svg {...p}>
          <g transform="rotate(-30 12 12)">
            <rect x="0.5" y="9.5" width="7" height="5" rx=".6" fill="#2563eb" />
            <path d="M2.8 9.5v5M5.2 9.5v5M.5 12h7" stroke="#93c5fd" strokeWidth=".7" />
            <rect x="16.5" y="9.5" width="7" height="5" rx=".6" fill="#2563eb" />
            <path d="M18.8 9.5v5M21.2 9.5v5M16.5 12h7" stroke="#93c5fd" strokeWidth=".7" />
            <path d="M7.5 12h2M14.5 12h2" stroke="#cbd5e1" strokeWidth="1.2" />
            <rect x="9.5" y="8" width="5" height="8" rx="1.2" fill="#e2e8f0" />
            <path d="M12 8V5.5" stroke="#cbd5e1" strokeWidth="1.2" />
            <path d="M9.6 5.2a2.6 2.6 0 0 0 4.8 0z" fill="#f8fafc" />
            <circle cx="12" cy="12" r="1.2" fill="#22d3ee" />
          </g>
        </svg>
      );
    case "moon":
      return (
        <svg {...p}>
          <path d="M19 15.5A8 8 0 0 1 8.5 5a8 8 0 1 0 10.5 10.5z" fill="#fde68a" />
          <circle cx="11" cy="15" r="1.2" fill="#f59e0b" opacity=".5" /><circle cx="14" cy="18.5" r=".8" fill="#f59e0b" opacity=".5" />
          <path d="M18 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="#e0f2fe" />
        </svg>
      );
    case "muscle":
      return (
        <svg {...p}>
          <path d="M4.5 21.5C4 16 6 11.5 9.5 9.2L8.6 5.6c-.3-1.4 1.2-2.5 2.4-1.6l2.2 3.3c3.2-.6 6.4 1.1 6.9 4.3.6 3.6-2 6.6-5.8 7.2l-4.6 2.7z" fill="#fbbf24" />
          <circle cx="10.4" cy="4.6" r="2.5" fill="#f59e0b" />
          <path d="M11.5 13.5c1.6-1.8 4.6-1.6 5.6.6" stroke="#b45309" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M6 21.5h7" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "sun":
      return (
        <svg {...p}>
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d="M12 1.5v3.2" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" transform={`rotate(${i * 45} 12 12)`} />
          ))}
          <circle cx="12" cy="12" r="5.2" fill="#f59e0b" />
          <circle cx="12" cy="12" r="5.2" fill="none" stroke="#fde68a" strokeWidth="1" />
        </svg>
      );
    default:
      return null;
  }
}
