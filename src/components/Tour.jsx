// Tutorial guiado: aparece cada vez que alguien entra a la página.
// Globos tipo "coach mark" anclados a cada botón, con flecha, paso actual, "Next" y "Not now".
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const STEPS = [
  { sel: '[data-tour="random"]', title: "Load a random crew member", body: "Picks a random subject and study day from the CFT70 database. It's a new person, so the daily check-in starts from zero." },
  { sel: '[data-tour="timeline"]', title: "Travel through the study", body: "Use ‹ › to move between study days, or Replay to watch 70 days of bed rest change the heart." },
  { sel: '[data-tour="pulse"]', title: "Live pulse & oxygen", body: "Pulse and SpO₂ update every second. The pulse is simulated starting from the real value in the database." },
  { sel: ".hm-heart svg", title: "Tap a part of the heart", body: "Each region opens its details. Rate & timing shows a live ECG of the simulated pulse." },
  { sel: ".hm-chart .seg", title: "Filter your metrics", body: "Switch between All, Size and Flow to see how each measurement changed vs. before bed rest." },
  { sel: ".tip-nav", title: "Health tips", body: "Use the arrows to go through the tips — on mobile you can also swipe." },
  { sel: '[data-tour="tab-counter"]', title: "Countermeasures", body: "Compare the 4 study groups and see which exercise protected the heart best." },
  { sel: '[data-tour="tab-checkin"]', title: "Daily check-in", body: "Log mood, sleep and stress. Your week and badges update as soon as you save." },
];

const W = 320;
const visible = (sel) => [...document.querySelectorAll(sel)].find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

export default function Tour({ onStart }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(true);
  const [rect, setRect] = useState(null);

  useEffect(() => { onStart?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => setOpen(false), []);

  // Pasos sin elemento visible (p. ej. otra vista) se saltan
  const measure = useCallback(() => {
    const el = visible(STEPS[i].sel);
    setRect(el ? el.getBoundingClientRect() : null);
    return el;
  }, [i]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = visible(STEPS[i].sel);
    if (!el) {
      if (i < STEPS.length - 1) setI(i + 1); else setOpen(false);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "instant" });
    measure();
  }, [i, open, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" || (e.key === "Enter" && e.target.tagName !== "BUTTON")) setI((k) => (k < STEPS.length - 1 ? k + 1 : (close(), k)));
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
  }, [open, measure, close]);

  if (!open || !rect) return null;

  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(W, vw - 24);
  const below = vh - rect.bottom > 230 || rect.top < 230;
  const left = Math.min(Math.max(12, rect.left + rect.width / 2 - w / 2), vw - w - 12);
  const arrowX = Math.min(Math.max(18, rect.left + rect.width / 2 - left), w - 18);
  const pad = 6;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Quick tour">
      <div className="tour-catch" onClick={close} />
      <div className="tour-spot" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      <div key={i} className={`tour-pop ${below ? "below" : "above"}`}
        style={{ left, width: w, ...(below ? { top: rect.bottom + 14 } : { bottom: vh - rect.top + 14 }), "--ax": `${arrowX}px` }}>
        <div className="tour-kicker">✨ Quick tour · {i + 1} of {STEPS.length}</div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button className="tour-next" onClick={() => (last ? close() : setI(i + 1))}>{last ? "Got it" : "Next"}</button>
          {i > 0 && <button className="tour-ghost" onClick={() => setI(i - 1)}>Back</button>}
          {!last && <button className="tour-ghost" onClick={close}>Not now</button>}
        </div>
      </div>
    </div>
  );
}
