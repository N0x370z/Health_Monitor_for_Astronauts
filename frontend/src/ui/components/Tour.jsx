// Tutorial guiado (coach marks) con la paleta de ORBIT CARE. Resalta cada elemento de la sección,
// muestra el paso y se maneja con Next / Back / Skip, flechas o Esc. Pasos en domain/tour.js.
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { TOURS } from "../../domain/tour.js";
import { Icon } from "./ui.jsx";

const W = 340;
const NONE = [];
const visible = (sel) => [...document.querySelectorAll(sel)].find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

export function TourButton({ onClick }) {
  return (
    <button className="tour-btn" onClick={onClick} title="Show the guided tour of this section">
      <Icon name="book" size={18} /><span>How it works</span>
    </button>
  );
}

export default function Tour({ tab, onClose }) {
  const steps = TOURS[tab] ?? NONE;
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  const measure = useCallback(() => {
    const el = steps[i] && visible(steps[i].sel);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [i, steps]);

  // Ir al elemento del paso; si no está en pantalla, saltar al siguiente
  useLayoutEffect(() => {
    const el = steps[i] && visible(steps[i].sel);
    if (!el) {
      if (i < steps.length - 1) setI(i + 1); else onClose();
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "instant" });
    measure();
  }, [i, steps, measure, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((k) => (k < steps.length - 1 ? k + 1 : (onClose(), k)));
      if (e.key === "ArrowLeft") setI((k) => Math.max(0, k - 1));
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [steps.length, measure, onClose]);

  if (!rect || !steps[i]) return null;
  const step = steps[i];
  const last = i === steps.length - 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(W, vw - 24);
  const below = vh - rect.bottom > 250 || rect.top < 250;
  const left = Math.min(Math.max(12, rect.left + rect.width / 2 - w / 2), vw - w - 12);
  const arrowX = Math.min(Math.max(22, rect.left + rect.width / 2 - left), w - 22);
  const pad = 6;
  // Elementos muy altos: el globo va dentro de la pantalla, no fuera
  const top = below ? Math.min(rect.bottom + 14, vh - 230) : undefined;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Guided tour">
      <div className="tour-catch" onClick={onClose} />
      <div className="tour-spot" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      <div key={i} className={`tour-pop ${below ? "below" : "above"}`}
        style={{ left, width: w, ...(below ? { top } : { bottom: vh - rect.top + 14 }), "--ax": `${arrowX}px` }}>
        <div className="tour-head">
          <span className="tour-kicker">How it works · {i + 1} of {steps.length}</span>
          <button className="tour-x" onClick={onClose} aria-label="Close tour"><Icon name="close" size={16} /></button>
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-foot">
          <div className="tour-dots" aria-hidden="true">{steps.map((s, k) => <i key={s.title} className={k === i ? "on" : k < i ? "done" : ""} />)}</div>
          <div className="tour-actions">
            {i > 0 ? <button className="btn sm" onClick={() => setI(i - 1)}>Back</button> : <button className="btn sm ghost" onClick={onClose}>Skip</button>}
            <button className="btn sm primary" onClick={() => (last ? onClose() : setI(i + 1))} autoFocus>{last ? "Got it" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
