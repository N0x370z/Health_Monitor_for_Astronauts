// Drawer de sistema, modal de alerta y modal de reporte a la Tierra.
import { useEffect, useState } from "react";
import { Icon, Dot, Evidence, Sparkline } from "../components/ui.jsx";
import Ecg from "../components/Ecg.jsx";
import { TIMEPOINTS } from "../../data/echo.js";
import { STATUS_LABEL, STATUS_COLOR } from "../../domain/config.js";

function useEsc(onClose) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
}

// Monitor en vivo (simulado) para "Rate & timing": ECG + pulso + SpO₂
function LiveMonitor({ live }) {
  const from = TIMEPOINTS.find((t) => t.key === live.baseFrom);
  return (
    <div className="live-mon">
      <div className="live-head">
        <span className="live-badge"><i />LIVE · SIMULATED</span>
        <span>ECG · Lead II</span>
      </div>
      <Ecg hr={live.hr} />
      <div className="live-tiles">
        <div className="live-tile">
          <span className="lt-lab"><span className="lt-heart" style={{ animationDuration: live.hr ? `${60 / live.hr}s` : "0s" }}>♥</span> Pulse</span>
          <b className={live.hr == null ? "err-val" : ""}>{live.hr == null ? "Error" : Math.round(live.hr)}<small>{live.hr == null ? "" : "bpm"}</small></b>
          <Sparkline data={live.hrHist} color="#4ade80" height={30} />
          <small className="lt-src">{live.hr == null ? "No HR in the database for this subject" : `Starts at ${Math.round(live.base)} bpm · DB ${from?.label ?? ""}${live.exact ? "" : " (nearest)"}`}</small>
        </div>
        <div className="live-tile">
          <span className="lt-lab">SpO₂</span>
          <b style={{ color: "#67e8f9" }}>{Math.round(live.spo2)}<small>%</small></b>
          <Sparkline data={live.spHist} color="#67e8f9" height={30} min={92} max={100} />
          <small className="lt-src">Not in database · reference 98%</small>
        </div>
      </div>
    </div>
  );
}

export function SystemDrawer({ system: incoming, onClose, live }) {
  // Conserva el último contenido para animar la salida (slide out) antes de desmontar
  const [last, setLast] = useState(incoming);
  if (incoming && incoming !== last) setLast(incoming);
  useEsc(onClose);
  const system = incoming ?? last;
  if (!system) return null;
  const leaving = !incoming;
  return (
    <div className={`drawer-wrap ${leaving ? "leaving" : ""}`} onClick={onClose}>
      <aside className="card drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={system.name}
        onAnimationEnd={(e) => { if (leaving && e.target === e.currentTarget) setLast(null); }}>
        <button className="close" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        <div className="section-title" style={{ marginTop: 0 }}>{system.sub}</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, display: "flex", alignItems: "center", gap: 10 }}>
          <Dot status={system.status} />{system.name}
        </h2>
        <div style={{ marginTop: 6, color: STATUS_COLOR[system.status], fontWeight: 700 }}>{system.score == null ? "Error · no data at this timepoint" : `${STATUS_LABEL[system.status]} · score ${system.score}/100`}</div>

        {system.key === "rhythm" && live && <><div className="section-title">Live monitor</div><LiveMonitor live={live} /></>}

        <div className="section-title">Indicators</div>
        {system.metrics.map(([k, v]) => <div className="kv" key={k}><span>{k}</span><b>{v}</b></div>)}

        <div className="section-title">Why it matters</div>
        <p style={{ margin: 0, color: "var(--text-2)", lineHeight: 1.55 }}>{system.why}</p>
        <p className="muted" style={{ marginTop: 6 }}>Risk: <b>{system.risk}</b> · Hazard: {system.hazard}</p>

        <div className="section-title">How to measure</div>
        <ul className="steps">{system.measure.map((m) => <li key={m}>{m}</li>)}</ul>

        <div className="section-title">What to do</div>
        <ul className="steps">{system.actions.map((m) => <li key={m}>{m}</li>)}</ul>

        <div style={{ marginTop: 16 }}><Evidence keys={system.evidence} /></div>
      </aside>
    </div>
  );
}

export function ReportModal({ text, delay, onClose }) {
  useEsc(onClose);
  const [state, setState] = useState("draft");
  if (text == null) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setState("copied"); } catch { setState("copy-failed"); }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Earth report">
        <button className="close" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>Report for flight surgeon</h2>
        <p className="muted">Compressed summary queued for the next comm window · Link: {delay}</p>
        <pre className="report">{text}</pre>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => setState("queued")} disabled={state === "queued"}><Icon name="send" size={16} /> {state === "queued" ? "Queued for uplink" : "Queue for uplink"}</button>
          <button className="btn" onClick={copy}>{state === "copied" ? "Copied" : state === "copy-failed" ? "Copy failed" : "Copy text"}</button>
        </div>
      </div>
    </div>
  );
}
