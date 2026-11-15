// Banner de alertas del tripulante: qué está en riesgo, por qué y qué hacer.
import { useState } from "react";
import { Icon } from "./ui.jsx";
import { alertSummary } from "../../domain/alerts.js";

const LEVEL_LABEL = { crit: "Critical", warn: "Attention", info: "Plan" };

export default function AlertBanner({ alerts, source, onSeeHeart }) {
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(null); // lista que el tripulante ya vio ("Got it")
  const { list } = alerts;
  const s = alertSummary(list);
  const sig = list.map((a) => a.id).join(",");

  if (s.level === "ok") {
    return (
      <div className="alert-banner ok" role="status" data-tour="alerts">
        <span className="ab-ico"><Icon name="check" size={22} /></span>
        <div className="ab-body"><b>No active alerts</b><span>Every measured value is within its limits or within measurement error.</span></div>
      </div>
    );
  }

  const top = list.find((a) => a.level === s.level);
  const seen = ack === sig;
  const count = [s.crit && `${s.crit} critical`, s.warn && `${s.warn} attention`].filter(Boolean).join(" · ");

  return (
    <div className={`alert-banner ${s.level} ${seen ? "seen" : ""}`} role={s.level === "crit" && !seen ? "alert" : "status"} data-tour="alerts">
      <div className="ab-head">
        <span className="ab-ico"><Icon name="alert" size={22} /></span>
        <div className="ab-body">
          <b>{s.level === "crit" ? "Action needed" : "Keep an eye on this"} · {count}</b>
          <span><strong>{top.title}.</strong> {top.action}</span>
        </div>
        <div className="ab-actions">
          <button className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Hide" : `See all (${list.length})`}
          </button>
          {!seen && <button className="btn ghost" onClick={() => setAck(sig)}>Got it</button>}
        </div>
      </div>

      {open && (
        <ul className="ab-list">
          {list.map((a) => (
            <li key={a.id} className={`ab-item ${a.level}`}>
              <span className={`ab-chip ${a.level}`}>{a.kind === "trend" ? "Trend" : LEVEL_LABEL[a.level]}</span>
              <div>
                <b>{a.title}</b>
                <p><span>Why:</span> {a.why}</p>
                <p><span>What to do:</span> {a.action}</p>
                {a.countermeasure && <p><span>Countermeasure:</span> {a.countermeasure}</p>}
              </div>
            </li>
          ))}
          <li className="ab-foot">
            {source === "api"
              ? "From the project database: rules with clinical sources; changes smaller than the measurement error do not raise alerts."
              : "Offline: computed in the app from the echo values. Connect to the API for the full rules and the trend alarm."}
            {onSeeHeart && <button className="btn ghost" onClick={onSeeHeart}>Open the heart</button>}
          </li>
        </ul>
      )}
    </div>
  );
}
