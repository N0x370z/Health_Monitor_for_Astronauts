// Drawer de sistema, modal de alerta y modal de reporte a la Tierra.
import { useEffect, useState } from "react";
import { Icon, Dot, Evidence } from "../components/ui.jsx";
import { STATUS_LABEL, STATUS_COLOR } from "../data/config.js";

function useEsc(onClose) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
}

export function SystemDrawer({ system, onClose }) {
  useEsc(onClose);
  if (!system) return null;
  return (
    <div className="drawer-wrap" onClick={onClose}>
      <aside className="card drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={system.name}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="section-title" style={{ marginTop: 0 }}>{system.sub}</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, display: "flex", alignItems: "center", gap: 10 }}>
          <Dot status={system.status} />{system.name}
        </h2>
        <div style={{ marginTop: 6, color: STATUS_COLOR[system.status], fontWeight: 700 }}>{STATUS_LABEL[system.status]} · score {system.score}/100</div>

        <div className="section-title">Indicators</div>
        {system.metrics.map(([k, v]) => <div className="kv" key={k}><span>{k}</span><b>{v}</b></div>)}

        <div className="section-title">Why it matters</div>
        <p style={{ margin: 0, color: "var(--text-2)", lineHeight: 1.55 }}>{system.why}</p>
        <p className="muted" style={{ marginTop: 6 }}>NASA HRP risk: <b>{system.risk}</b> · Hazard: {system.hazard}</p>

        <div className="section-title">How to measure</div>
        <ul className="steps">{system.measure.map((m) => <li key={m}>{m}</li>)}</ul>

        <div className="section-title">What to do</div>
        <ul className="steps">{system.actions.map((m) => <li key={m}>{m}</li>)}</ul>

        <div style={{ marginTop: 16 }}><Evidence keys={system.evidence} /></div>
      </aside>
    </div>
  );
}

export function AlertModal({ alert, onClose, onAction, onReport }) {
  useEsc(onClose);
  const [done, setDone] = useState({});
  if (!alert) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`card modal state-${alert.status}`} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label={alert.title}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="section-title" style={{ marginTop: 0, color: STATUS_COLOR[alert.status] }}>{STATUS_LABEL[alert.status]} · {alert.hazard}</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 21 }}>{alert.title}</h2>
        <p style={{ color: "var(--text-2)", lineHeight: 1.55 }}>{alert.detail}</p>
        <div className="section-title">Do this now</div>
        {alert.steps.map((s, i) => (
          <label key={s} className="kv" style={{ cursor: "pointer", justifyContent: "flex-start", gap: 10 }}>
            <input type="checkbox" checked={!!done[i]} onChange={() => setDone((d) => ({ ...d, [i]: !d[i] }))} style={{ accentColor: "var(--cyan)", width: 18, height: 18 }} />
            <span style={{ color: done[i] ? "var(--text-3)" : "var(--text)", textDecoration: done[i] ? "line-through" : "none" }}>{i + 1}. {s}</span>
          </label>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {alert.action && <button className={`btn ${alert.status === "crit" ? "danger" : "primary"}`} onClick={() => { onAction(alert.action.type); onClose(); }}><Icon name="shield" size={16} /> {alert.action.label}</button>}
          <button className="btn" onClick={onReport}><Icon name="send" size={16} /> Send report to Earth</button>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <div style={{ marginTop: 14 }}><Evidence keys={alert.evidence} /></div>
      </div>
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
        <button className="close" onClick={onClose} aria-label="Close">×</button>
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
