// Mini tutorial por sección (contenido en data/tutorial.js). Se vuelve a abrir con "How it works".
import { useEffect, useState } from "react";
import { Icon } from "./ui.jsx";
import { TOURS } from "../data/tutorial.js";

export function TutorialButton({ onClick }) {
  return (
    <button className="btn sm ghost tour-btn" onClick={onClick} title="Show the mini tutorial for this section">
      <Icon name="book" size={16} /> How it works
    </button>
  );
}

export default function Tutorial({ tab, onClose }) {
  const tour = TOURS[tab];
  const [i, setI] = useState(0);
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, tour.steps.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, tour]);
  if (!tour) return null;
  const step = tour.steps[i];
  const last = i === tour.steps.length - 1;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal tour" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${tour.title} tutorial`}>
        <button className="close" onClick={onClose} aria-label="Close tutorial"><Icon name="close" size={20} /></button>
        <p className="tour-kicker">How it works · {tour.title} · {i + 1}/{tour.steps.length}</p>
        <div className="tour-step">
          <span className="tour-icon"><Icon name={step.icon} size={26} /></span>
          <div>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
        </div>
        <div className="tour-dots" role="tablist" aria-label="Tutorial steps">
          {tour.steps.map((s, j) => (
            <button key={s.title} className={j === i ? "on" : ""} onClick={() => setI(j)} aria-label={`Step ${j + 1}: ${s.title}`} aria-selected={j === i} role="tab" />
          ))}
        </div>
        <div className="tour-actions">
          <button className="btn sm ghost" onClick={onClose}>Skip</button>
          <span style={{ flex: 1 }} />
          {i > 0 && <button className="btn sm" onClick={() => setI(i - 1)}>Back</button>}
          <button className="btn sm primary" onClick={last ? onClose : () => setI(i + 1)}>{last ? "Got it" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
