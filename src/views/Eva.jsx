import { Card, Icon, Sparkline, RadialGauge, Dot, Evidence } from "../components/ui.jsx";
import { STATUS_COLOR, AIRLOCK_TRANSIT_MIN, classify } from "../data/config.js";
import { fmtMin } from "../sim/analytics.js";

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

export default function Eva({ sim, rad, dispatch }) {
  const eva = sim.eva;
  const elapsed = eva.active ? sim.t - eva.start : 0;
  const o2Left = (eva.o2Pct / 100) * 450;
  const remaining = eva.active ? Math.max(0, Math.min(eva.plannedMin - elapsed, o2Left)) : eva.plannedMin;
  const returnBy = Math.min(remaining, rad.exp.exponential ? rad.timeToCrit : Infinity) - AIRLOCK_TRANSIT_MIN;
  const evaStatus = !eva.active ? "ok" : returnBy <= 0 ? "crit" : returnBy < 15 ? "warn" : "ok";
  const series = sim.hist.radRate.slice(-60).map((p) => p.v);

  if (!eva.active) {
    return (
      <div className="two">
        <Card title="EVA / Spacewalk mode" icon={<Icon name="suit" />}>
          <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>
            Switch to EVA mode before leaving the airlock. ORBIT CARE tracks radiation outside the habitat, suit consumables and your vitals,
            and tells you <b>when to come back</b> — including if radiation starts rising exponentially.
          </p>
          <div className="kv"><span>Planned duration</span><b>{hhmm(eva.plannedMin)} h</b></div>
          <div className="kv"><span>Airlock transit</span><b>{AIRLOCK_TRANSIT_MIN} min</b></div>
          <div className="kv"><span>Current dose rate (habitat)</span><b>{Math.round(sim.env.radRate)} µSv/h</b></div>
          <div className="kv"><span>Heart rate</span><b>{Math.round(sim.vitals.hr)} bpm</b></div>
          <div style={{ marginTop: 16 }}>
            <button className="btn primary" disabled={rad.exp.exponential || rad.status === "crit"} onClick={() => dispatch({ type: "evaStart" })}>Start EVA</button>
            {(rad.exp.exponential || rad.status === "crit") && <p className="c-crit" style={{ fontWeight: 600 }}>EVA blocked: radiation event in progress.</p>}
          </div>
        </Card>
        <Card title="Pre-EVA checklist">
          <ul className="steps">
            <li>Suit pressure check (29.6 kPa)</li><li>O₂ tanks 100%</li><li>Pre-breathe protocol completed</li>
            <li>Personal dosimeter on</li><li>Comm check with crew</li>
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className={`statusbar ${evaStatus}`} style={{ marginBottom: 14 }}>
        <Icon name={evaStatus === "ok" ? "check" : "alert"} color={STATUS_COLOR[evaStatus]} />
        <span className="grow">
          {evaStatus === "crit" ? "RETURN TO AIRLOCK NOW" : evaStatus === "warn" ? `Start heading back in ${fmtMin(returnBy)}` : `On plan · head back in ${fmtMin(returnBy)}`}
          {rad.exp.exponential && <> · radiation doubling every {rad.exp.doublingMin.toFixed(1)} min</>}
        </span>
        <button className="btn sm danger" onClick={() => dispatch({ type: "evaEnd" })}>End EVA (in airlock)</button>
      </div>

      <div className="three">
        <Card title="EVA time" icon={<Icon name="suit" />} status={evaStatus}>
          <div className="muted">Remaining</div>
          <div className="big mono" style={{ fontSize: 44 }}>{hhmm(remaining)}</div>
          <div className="kv" style={{ marginTop: 10 }}><span>Elapsed</span><b>{hhmm(elapsed)}</b></div>
          <div className="kv"><span>Return-by margin</span><b className={`c-${evaStatus}`}>{fmtMin(Math.max(0, returnBy))}</b></div>
          <div className="kv"><span>Limited by</span><b>{rad.exp.exponential && rad.timeToCrit < Math.min(eva.plannedMin - elapsed, o2Left) ? "Radiation" : o2Left < eva.plannedMin - elapsed ? "O₂" : "Plan"}</b></div>
        </Card>
        <Card title="Radiation outside" icon={<Icon name="radiation" size={20} />} status={rad.status}>
          <div style={{ display: "flex", justifyContent: "center" }}><RadialGauge value={rad.rate} unit="µSv/h" label="EVA dose" status={rad.status} size={170} /></div>
          <Sparkline data={series} color={STATUS_COLOR[rad.status === "ok" ? "watch" : rad.status]} />
          <div className="kv"><span>EVA dose so far</span><b>{eva.doseUSv.toFixed(0)} µSv</b></div>
        </Card>
        <Card title="Suit" icon={<Icon name="shield" />}>
          <div className="kv"><span>O₂ supply</span><b>{eva.o2Pct.toFixed(0)} %</b></div>
          <div className="bar" style={{ margin: "4px 0 8px" }}><i style={{ width: `${eva.o2Pct}%`, background: "linear-gradient(90deg,var(--teal),var(--cyan))" }} /></div>
          <div className="kv"><span>Suit pressure</span><b>{eva.suitPressure.toFixed(1)} kPa</b></div>
          <div className="kv"><span>Suit CO₂</span><b>{eva.suitCo2.toFixed(1)} mmHg</b></div>
          <div className="kv"><span>Metabolic rate</span><b>{Math.round(eva.metabolic)} kcal/h</b></div>
          <div className="kv"><span><Dot status={classify("hr", sim.vitals.hr > 130 ? 140 : 80)} /> Heart rate</span><b>{Math.round(sim.vitals.hr)} bpm</b></div>
          <div className="kv"><span>SpO₂</span><b>{sim.vitals.spo2.toFixed(0)} %</b></div>
        </Card>
      </div>
      <div style={{ marginTop: 14 }}><Evidence keys={["radApollo", "radSkylab"]} /></div>
    </>
  );
}
