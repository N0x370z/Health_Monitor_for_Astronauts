import { useState } from "react";
import { Card, Dot, Evidence, Icon } from "../components/ui.jsx";
import { ECHO, TREATMENTS, TIMEPOINTS } from "../data/echo.js";
import { HM, groupChange, heartState, fmt } from "../sim/heart.js";
import { STATUS_LABEL } from "../data/config.js";

const KEYS = ["lvMass", "edv", "sv", "vti", "hr"];
const COLORS = { Control: "#f43f5e", "Exercise A": "#22d3ee", "Exercise B": "#4ade80", Flywheel: "#a78bfa" };

function GroupBars({ k, tpKey }) {
  const g = groupChange(k, tpKey);
  const max = Math.max(10, ...TREATMENTS.map((t) => Math.abs(g[t].mean ?? 0)));
  return (
    <Card title={HM[k].label} sub={`${TIMEPOINTS.find((t) => t.key === tpKey).label} vs Pre`}>
      {TREATMENTS.map((t) => {
        const m = g[t].mean;
        const w = m == null ? 0 : (Math.abs(m) / max) * 50;
        return (
          <div className="gbar" key={t}>
            <span className="gname">{t} <small>n={g[t].n}</small></span>
            <div className="gtrack">
              <span className="gzero" />
              <i style={{ width: `${w}%`, left: m < 0 ? `${50 - w}%` : "50%", background: COLORS[t] }} />
            </div>
            <b className="mono">{m == null ? "—" : `${m > 0 ? "+" : ""}${m.toFixed(1)}%`}</b>
          </div>
        );
      })}
    </Card>
  );
}

export default function Countermeasures({ onOpenSubject }) {
  const [tpKey, setTpKey] = useState("d70");
  const lv = groupChange("lvMass", "d70");
  const crew = ECHO.crewIds.map((id) => ECHO.subjects[id]);
  return (
    <>
      <div className="kpi-row">
        <div className="kcard k-pink"><div className="kicon"><Icon name="heartLine" size={28} /></div><div className="kbody">
          <div className="klabel">No countermeasure</div><div className="kval">{lv.Control.mean.toFixed(1)}%</div><div className="ksub">LV mass after 70 days</div></div></div>
        <div className="kcard k-green"><div className="kicon"><Icon name="dumbbell" size={28} /></div><div className="kbody">
          <div className="klabel">Best protocol</div><div className="kval">Exercise B</div><div className="ksub">LV mass {lv["Exercise B"].mean.toFixed(1)}%</div></div></div>
        <div className="kcard k-blue"><div className="kicon"><Icon name="user" size={28} /></div><div className="kbody">
          <div className="klabel">Study subjects</div><div className="kval">{Object.values(ECHO.subjects).filter((x) => x.treatment !== "Unassigned").length}</div><div className="ksub">4 groups · 70-day bed rest</div></div></div>
        <div className="kcard k-purple"><div className="kicon"><Icon name="suit" size={28} /></div><div className="kbody">
          <div className="klabel">Crew monitored</div><div className="kval">{crew.length}</div><div className="ksub">7-subject echo set</div></div></div>
      </div>
      <Card title="What the data says" icon={<Icon name="bulb" />} style={{ marginBottom: 18 }}>
        <div className="insight"><span className="dot crit" style={{ marginTop: 6 }} /><span>
          Without a countermeasure (Control, n={lv.Control.n}) the left ventricle lost <b>{Math.abs(lv.Control.mean).toFixed(1)}%</b> of its mass after 70 days of head-down bed rest.
        </span></div>
        <div className="insight"><span className="dot ok" style={{ marginTop: 6 }} /><span>
          Exercise protocols limited the loss: Exercise B <b>{lv["Exercise B"].mean.toFixed(1)}%</b>, Flywheel <b>{lv.Flywheel.mean.toFixed(1)}%</b>, Exercise A <b>{lv["Exercise A"].mean.toFixed(1)}%</b>.
          ORBIT CARE recommends keeping the assigned exercise program every day of the mission.
        </span></div>
        <div className="insight"><span className="dot warn" style={{ marginTop: 6 }} /><span>
          On return (R+0) heart rate rises and forward flow (LVOT VTI) drops — the deconditioning pattern behind dizziness after landing. Plan fluid loading before re-entry.
        </span></div>
      </Card>

      <div className="seg" style={{ marginBottom: 16 }} role="tablist" aria-label="Compare timepoint">
        {TIMEPOINTS.filter((t) => t.key !== "pre").map((t) => (
          <button key={t.key} className={t.key === tpKey ? "on" : ""} onClick={() => setTpKey(t.key)}>{t.label}</button>
        ))}
      </div>
      <div className="three">
        {KEYS.map((k) => <GroupBars key={k} k={k} tpKey={tpKey} />)}
        <Card title="How to read" icon={<Icon name="list" />}>
          <p style={{ margin: 0, color: "var(--text-2)", lineHeight: 1.6, fontSize: 14 }}>
            Each bar is the average change of a group versus its own pre-bed-rest baseline. Bars to the left of the line mean the value
            went down. Pick a timepoint above to see how the heart adapts during bed rest (D7–D70) and recovers (R+0, R+3).
          </p>
          <div className="legend" style={{ marginTop: 14 }}>
            {Object.entries(COLORS).map(([t, c]) => <span key={t}><i style={{ background: c, width: 12, height: 12, borderRadius: 4 }} />{t}</span>)}
          </div>
        </Card>
      </div>

      <Card title="Crew (7-subject set)" icon={<Icon name="user" />} sub="status at bed-rest day 70 · click to open" style={{ marginTop: 18 }}>
        <div className="etable-wrap">
          <table className="etable crew">
            <thead><tr><th>Subject</th><th>Countermeasure</th><th>Heart score</th><th>LV mass Δ</th><th>HR D70</th><th>Status</th></tr></thead>
            <tbody>
              {crew.map((s) => {
                const hs = heartState(s, "d70");
                const d = s.tp.d70?.lvMass && s.tp.pre?.lvMass ? ((s.tp.d70.lvMass - s.tp.pre.lvMass) / s.tp.pre.lvMass) * 100 : null;
                return (
                  <tr key={s.id} onClick={() => onOpenSubject(s.id)} style={{ cursor: "pointer" }}>
                    <td className="mname">{s.id}</td>
                    <td>{s.treatment}</td>
                    <td className="mono">{hs.score ?? <span className="err-val">Error</span>}</td>
                    <td className="mono">{d == null ? <span className="err-val">Error</span> : `${d > 0 ? "+" : ""}${d.toFixed(1)}%`}</td>
                    <td className="mono">{s.tp.d70?.hr == null ? <span className="err-val">Error</span> : fmt("hr", s.tp.d70.hr)}</td>
                    <td><Dot status={hs.status} /> {STATUS_LABEL[hs.status]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div style={{ marginTop: 14 }}><Evidence keys={["echoAll", "echo3d", "echoCrew"]} /></div>
    </>
  );
}
