import { useEffect, useMemo, useState } from "react";
import { useSimulation } from "./sim/useSimulation.js";
import { buildAlerts, buildSystems, earthReport } from "./sim/health.js";
import { loadCheckins, saveCheckins, resetCheckins, TODAY } from "./sim/history.js";
import { MISSIONS } from "./data/config.js";
import { Icon, Dot } from "./components/ui.jsx";
import Overview from "./views/Overview.jsx";
import CheckIn from "./views/CheckIn.jsx";
import Eva from "./views/Eva.jsx";
import Trends from "./views/Trends.jsx";
import { SystemDrawer, AlertModal, ReportModal } from "./views/Panels.jsx";

const TABS = [
  ["overview", "Overview", "body", "Home"],
  ["checkin", "Daily check-in", "pen", "Log"],
  ["eva", "EVA mode", "suit", "EVA"],
  ["trends", "Trends", "chart", "Trends"],
];

const SCENARIOS = [
  ["nominal", "Nominal"],
  ["storm", "☀ Solar storm"],
  ["co2", "CO₂ buildup"],
  ["fatigue", "Fatigue week"],
];

export default function App() {
  const [sim, dispatch] = useSimulation();
  const [tab, setTab] = useState("overview");
  const [history, setHistory] = useState(loadCheckins);
  const [systemKey, setSystemKey] = useState(null);
  const [alertId, setAlertId] = useState(null);
  const [dismissed, setDismissed] = useState(() => new Set());
  const [report, setReport] = useState(null);
  const [demoOpen, setDemoOpen] = useState(false);

  const today = history.find((d) => d.day === TODAY);
  const { alerts, rad } = useMemo(() => buildAlerts(sim, today), [sim, today]);
  const systems = useMemo(() => buildSystems(sim, today, history), [sim, today, history]);
  const openAlert = alerts.find((a) => a.id === alertId);

  // Abrir automáticamente una alerta crítica nueva (una vez por evento)
  const critId = alerts.find((a) => a.status === "crit" && !dismissed.has(a.id))?.id;
  useEffect(() => {
    if (critId && !alertId) setAlertId(critId);
  }, [critId, alertId]);

  const closeAlert = () => {
    if (alertId) setDismissed((d) => new Set(d).add(alertId));
    setAlertId(null);
  };

  const submitCheckin = (entry) => {
    const row = { ...entry, day: TODAY, done: true, hrv: Math.round(sim.vitals.hrv), co2: +sim.env.co2.toFixed(2), dose: +sim.doseMsv.toFixed(1), exerciseMin: today?.exerciseMin ?? 110 };
    const next = [...history.filter((d) => d.day !== TODAY), row];
    setHistory(next);
    saveCheckins(next);
  };

  const setScenario = (v) => {
    dispatch({ type: "scenario", value: v });
    setDismissed(new Set());
  };

  const openReport = () => setReport(earthReport(sim, systems, alerts, history));
  const worstStatus = alerts[0]?.status ?? "ok";
  const mission = MISSIONS[sim.mission];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Icon name="logo" size={34} />
          <h1>ORBIT CARE</h1>
        </div>
        <div className="topbar-right">
          <select className="chip" value={sim.mission} onChange={(e) => dispatch({ type: "mission", value: e.target.value })} aria-label="Mission environment">
            {Object.entries(MISSIONS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <span className="chip"><Icon name="signal" size={14} /> Earth: {mission.earthLink}</span>
          <span className="chip"><Dot status={worstStatus} /> {alerts.length ? `${alerts.length} alert${alerts.length > 1 ? "s" : ""}` : "On mission"}</span>
          <span className="day">DAY {TODAY}</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Sections">
        {TABS.map(([k, label, icon, short]) => (
          <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
            <Icon name={icon} size={16} /><span className="lbl">{label}</span><span className="lbl-s">{short}</span>
            {k === "checkin" && !today?.done && <Dot status="warn" />}
            {k === "eva" && sim.eva.active && <Dot status="watch" />}
          </button>
        ))}
      </nav>

      <main>
        {tab === "overview" && (
          <Overview sim={sim} rad={rad} systems={systems} alerts={alerts} today={today}
            onSelectSystem={setSystemKey} onOpenAlert={(a) => setAlertId(a.id)} onReport={openReport} goCheckin={() => setTab("checkin")} />
        )}
        {tab === "checkin" && <CheckIn history={history} onSubmit={submitCheckin} />}
        {tab === "eva" && <Eva sim={sim} rad={rad} dispatch={dispatch} />}
        {tab === "trends" && <Trends history={history} />}
      </main>

      <div className={`demo ${demoOpen ? "" : "closed"}`} role="toolbar" aria-label="Demo scenarios">
        <button className="toggle" onClick={() => setDemoOpen((o) => !o)} aria-expanded={demoOpen}>
          {demoOpen ? "✕" : `DEMO ▸ ${SCENARIOS.find(([k]) => k === sim.scenario)[1]}`}
        </button>
        {demoOpen && (
          <>
            <span>1s = 1min</span>
            {SCENARIOS.map(([k, label]) => (
              <button key={k} className={sim.scenario === k ? "on" : ""} onClick={() => setScenario(k)}>{label}</button>
            ))}
            <button onClick={() => setHistory(resetCheckins())} title="Reset daily log to sample data">↺ Log</button>
          </>
        )}
      </div>

      <SystemDrawer system={systems.find((s) => s.key === systemKey)} onClose={() => setSystemKey(null)} />
      {openAlert && (
        <AlertModal key={openAlert.id} alert={openAlert} onClose={closeAlert} onReport={() => { closeAlert(); openReport(); }}
          onAction={(type) => dispatch({ type: "shelter", value: type === "shelter" })} />
      )}
      {report != null && <ReportModal text={report} delay={mission.earthLink} onClose={() => setReport(null)} />}
    </div>
  );
}
