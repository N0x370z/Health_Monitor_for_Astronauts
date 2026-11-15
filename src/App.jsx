import { useEffect, useMemo, useState } from "react";
import { loadCheckins, saveCheckins, TODAY } from "./sim/history.js";
import { ECHO, SUBJECT_IDS, TIMEPOINTS } from "./data/echo.js";
import { heartState, findings, heartReport, HM, readingText } from "./sim/heart.js";
import { Icon, Dot } from "./components/ui.jsx";
import HeartMonitor from "./views/HeartMonitor.jsx";
import Countermeasures from "./views/Countermeasures.jsx";
import CheckIn from "./views/CheckIn.jsx";
import { SystemDrawer, ReportModal } from "./views/Panels.jsx";

const TABS = [
  ["heart", "Heart monitor", "heartLine", "Heart"],
  ["counter", "Countermeasures", "chart", "Crew"],
  ["checkin", "Daily check-in", "pen", "Log"],
];

const DEFAULT_SUBJECT = ECHO.crewIds.includes("6546") ? "6546" : SUBJECT_IDS[0];

function SubjectOptions() {
  return (
    <>
      <optgroup label="Crew (7)">
        {ECHO.crewIds.map((id) => <option key={id} value={id}>Subject {id}</option>)}
      </optgroup>
      <optgroup label="All study subjects">
        {SUBJECT_IDS.filter((id) => !ECHO.subjects[id].crew).map((id) => <option key={id} value={id}>Subject {id}</option>)}
      </optgroup>
    </>
  );
}

export default function App() {
  const [tab, setTab] = useState("heart");
  const [history, setHistory] = useState(loadCheckins);
  const [subjectId, setSubjectId] = useState(DEFAULT_SUBJECT);
  const [tpKey, setTpKey] = useState("d70");
  const [playing, setPlaying] = useState(false);
  const [chamberKey, setChamberKey] = useState(null);
  const [report, setReport] = useState(null);
  const [lastRandom, setLastRandom] = useState(null);
  const [spin, setSpin] = useState(false);

  const subject = ECHO.subjects[subjectId];
  const hs = useMemo(() => heartState(subject, tpKey), [subject, tpKey]);
  const fnd = useMemo(() => findings(subject, tpKey), [subject, tpKey]);
  const today = history.find((d) => d.day === TODAY);

  // Reproducir la línea de tiempo del estudio
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setTpKey((k) => {
        const i = TIMEPOINTS.findIndex((t) => t.key === k);
        if (i >= TIMEPOINTS.length - 1) { setPlaying(false); return k; }
        return TIMEPOINTS[i + 1].key;
      });
    }, 1400);
    return () => clearInterval(id);
  }, [playing]);

  // El check-in es entrada manual del astronauta (no está en la base de datos del estudio)
  const submitCheckin = (entry) => {
    const row = { ...entry, day: TODAY, done: true };
    const next = [...history.filter((d) => d.day !== TODAY), row];
    setHistory(next);
    saveCheckins(next);
  };

  const play = () => {
    if (playing) return setPlaying(false);
    setTpKey("pre");
    setPlaying(true);
  };

  const chamber = hs.chambers.find((c) => c.key === chamberKey);
  const drawerData = chamber && {
    ...chamber,
    metrics: chamber.readings.map((r) => [HM[r.k].label, readingText(r)]),
    evidence: ["echoAll", "echo3d"],
  };

  const openSubject = (id) => { setSubjectId(id); setTpKey("d70"); setTab("heart"); };
  const openReport = () => setReport(heartReport(subject, tpKey, hs, fnd));

  // Carga aleatoria: un sujeto y un momento del estudio que existan en los CSV
  const randomSample = () => {
    const ids = SUBJECT_IDS.filter((id) => ECHO.subjects[id].treatment !== "Unassigned");
    const id = ids[Math.floor(Math.random() * ids.length)];
    const tps = TIMEPOINTS.filter((t) => ECHO.subjects[id].tp[t.key]);
    const t = tps[Math.floor(Math.random() * tps.length)];
    setPlaying(false);
    setSubjectId(id);
    setTpKey(t.key);
    setTab("heart");
    setChamberKey(null);
    setLastRandom(`Subject ${id} · ${t.label} · ${ECHO.subjects[id].treatment}`);
    setSpin(true);
    setTimeout(() => setSpin(false), 450);
  };
  const tp = TIMEPOINTS.find((t) => t.key === tpKey);

  const HEAD = {
    heart: [`Hello, Subject ${subject.id}!`, `${tp.long} · ${subject.treatment} — keep your heart strong.`],
    counter: ["Countermeasures", "What 70 days of bed rest did to 37 hearts — and what protected them."],
    checkin: ["Daily check-in", "How are you today? It takes less than a minute."],
  }[tab];

  return (
    <div className="shell">
      {/* ---------- barra lateral (escritorio) ---------- */}
      <aside className="sidebar navy" aria-label="Main navigation">
        <div className="brand">
          <Icon name="brandHeart" size={72} />
          <h1>Orbit Care</h1>
          <p>Astronaut health manager</p>
        </div>
        {TABS.map(([k, label, icon]) => (
          <button key={k} className={`nav-item ${tab === k ? "active" : ""}`} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}>
            <Icon name={icon} size={20} />{label}
            {k === "checkin" && !today?.done && <Dot status="warn" />}
          </button>
        ))}
        <div className="side-foot">
          <div className="side-user">
            <div className="avatar">{subject.id.slice(0, 2)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <select value={subjectId} onChange={(e) => openSubject(e.target.value)} aria-label="Crew member">
                <SubjectOptions />
              </select>
              <small>{subject.treatment}{subject.crew ? " · crew" : ""}</small>
            </div>
            <Icon name="chevron" size={16} color="#9fb3d6" />
          </div>
          <button className="side-link" onClick={openReport}><Icon name="send" size={18} /> Report to flight surgeon</button>
        </div>
      </aside>

      {/* ---------- barra superior (móvil) ---------- */}
      <header className="mobile-top navy">
        <span className="brand-row"><Icon name="brandHeart" size={30} /> Orbit Care</span>
        <select value={subjectId} onChange={(e) => openSubject(e.target.value)} aria-label="Crew member">
          <SubjectOptions />
        </select>
      </header>

      <div className="main">
        <div className="page-head">
          <div>
            <h2>{HEAD[0]}</h2>
            <p>{HEAD[1]}</p>
          </div>
          <div className="head-actions">
            <button className={`random-btn ${spin ? "spin" : ""}`} onClick={randomSample} title="Load a random subject and timepoint from the CFT70 database">
              <Icon name="dice" size={22} /><span>Random data</span>
            </button>
            <small aria-live="polite">{lastRandom ? `Loaded: ${lastRandom}` : "From the CFT70 echo database"}</small>
          </div>
        </div>

        <main>
          {tab === "heart" && (
            <HeartMonitor subject={subject} tpKey={tpKey} setTp={(k) => { setPlaying(false); setTpKey(k); }} hs={hs} findings={fnd}
              onSelectChamber={setChamberKey} selectedChamber={chamberKey} onReport={openReport} playing={playing} onPlay={play} />
          )}
          {tab === "counter" && <Countermeasures onOpenSubject={openSubject} />}
          {tab === "checkin" && <CheckIn history={history} onSubmit={submitCheckin} />}
        </main>
      </div>

      {/* ---------- navegación inferior (móvil) ---------- */}
      <nav className="mobile-nav" aria-label="Sections">
        {TABS.map(([k, , icon, short]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}>
            <Icon name={icon} size={22} />{short}
            {k === "checkin" && !today?.done && <Dot status="warn" />}
          </button>
        ))}
      </nav>

      <SystemDrawer system={drawerData} onClose={() => setChamberKey(null)} />
      {report != null && <ReportModal text={report} delay="next comm window" onClose={() => setReport(null)} />}
    </div>
  );
}
