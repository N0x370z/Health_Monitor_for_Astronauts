import { Card, Icon, Sparkline, RadialGauge, Ring, Level, Dot, Evidence } from "../components/ui.jsx";
import BodyFigure from "../components/BodyFigure.jsx";
import { classify, STATUS_COLOR, STATUS_LABEL, CAREER_LIMIT_MSV, MISSIONS, worst } from "../data/config.js";
import { fmtMin } from "../sim/analytics.js";

function RadiationCard({ sim, rad }) {
  const series = sim.hist.radRate.slice(-60).map((p) => p.v);
  return (
    <Card title="Radiation" icon={<Icon name="radiation" size={22} />} status={rad.status}
      right={<span className="chip"><Dot status={rad.status} /> {sim.eva.active ? "EVA" : sim.sheltered ? "Shelter" : "Habitat"}</span>}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <RadialGauge value={rad.rate} unit="µSv/h" label="Dose rate" status={rad.status} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: -6 }}>
        <span className="muted">Cumulative (career)</span>
        <b className="mono" style={{ fontFamily: "var(--font-display)" }}>{sim.doseMsv.toFixed(1)} / {CAREER_LIMIT_MSV} mSv</b>
      </div>
      <div className="bar" style={{ margin: "6px 0 10px" }}>
        <i style={{ width: `${rad.careerPct}%`, background: "linear-gradient(90deg, var(--teal), var(--cyan))" }} />
      </div>
      <Sparkline data={series} color={STATUS_COLOR[rad.status === "ok" ? "watch" : rad.status]} />
      <div className="muted" style={{ marginTop: 6 }}>
        {rad.exp.exponential
          ? <span className="c-crit">▲ Exponential · doubling every {rad.exp.doublingMin.toFixed(1)} min · critical in ~{fmtMin(rad.timeToCrit)}</span>
          : `Baseline ${MISSIONS[sim.mission].baseRad} µSv/h · last 60 min`}
      </div>
    </Card>
  );
}

function CabinCard({ env }) {
  const rows = [
    ["CO₂", "co2", env.co2.toFixed(2), "%", 0, 1],
    ["O₂", "o2", env.o2.toFixed(1), "%", 17, 25],
    ["P", "pressure", env.pressure.toFixed(1), "kPa", 94, 105],
    ["T", "temp", env.temp.toFixed(1), "°C", 14, 31],
    ["RH", "humidity", env.humidity.toFixed(0), "%", 0, 100],
    ["dB", "noise", env.noise.toFixed(0), "dB", 30, 80],
  ];
  const st = worst(...rows.map((r) => classify(r[1], +r[2])));
  return (
    <Card title="Cabin Environment" icon={<Icon name="leaf" />} status={st} right={<Dot status={st} />}>
      {rows.map(([k, key, v, u, lo, hi]) => {
        const s = classify(key, +v);
        return (
          <div className="mrow" key={key}>
            <span className="k">{k}</span>
            <Level value={+v} min={lo} max={hi} status={s} />
            <span className={`v mono ${s !== "ok" ? `c-${s}` : ""}`} style={{ textAlign: "right" }}>{v}<small>{u}</small></span>
          </div>
        );
      })}
    </Card>
  );
}

function VitalsCards({ sim }) {
  const v = sim.vitals;
  const hrS = sim.eva.active ? "ok" : classify("hr", v.hr);
  const spS = classify("spo2", v.spo2);
  const small = [
    ["BP", `${Math.round(v.sys)}/${Math.round(v.dia)}`, "mmHg", worst(classify("sys", v.sys), classify("dia", v.dia))],
    ["Temp", v.bodyTemp.toFixed(1), "°C", classify("bodyTemp", v.bodyTemp)],
    ["Resp", v.rr.toFixed(0), "/min", classify("rr", v.rr)],
    ["Gluc", v.glucose.toFixed(0), "mg/dL", classify("glucose", v.glucose)],
  ];
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card title="Vitals" status={hrS}>
          <div className="big mono" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="heart" size={26} />{Math.round(v.hr)}<small>bpm</small>
          </div>
          <div className="muted" style={{ margin: "8px 0 2px" }}>HRV <b style={{ color: "var(--text)" }}>{Math.round(v.hrv)} ms</b></div>
          <Sparkline data={sim.hist.hrv.slice(-40).map((p) => p.v)} color="var(--crit)" height={30} />
        </Card>
        <Card title="SpO₂" icon={<Icon name="drop" />} status={spS}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <div className="big mono">{v.spo2.toFixed(0)}<small>%</small></div>
            <Ring value={v.spo2} color={STATUS_COLOR[spS === "ok" ? "watch" : spS]} />
          </div>
          <div className="muted" style={{ marginTop: 8 }}>Normal ≥ 95%</div>
        </Card>
      </div>
      <Card>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
          {small.map(([k, val, u, s]) => (
            <div key={k}>
              <div className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}><Dot status={s} />{k}</div>
              <div className="mono" style={{ fontFamily: "var(--font-display)", fontSize: 16, marginTop: 4 }}>{val}</div>
              <div className="muted">{u}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

export function SystemsList({ systems, selected, onSelect }) {
  return (
    <div>
      {systems.map((s) => (
        <button key={s.key} className={`sys ${selected === s.key ? "sel" : ""}`} onClick={() => onSelect(s.key)}>
          <Dot status={s.status} />
          <span className="name">{s.name}<small>{STATUS_LABEL[s.status]}</small></span>
          <span className="bar"><i style={{ width: `${s.score}%`, background: s.status === "ok" ? "linear-gradient(90deg, var(--blue), var(--cyan))" : STATUS_COLOR[s.status] }} /></span>
        </button>
      ))}
    </div>
  );
}

export default function Overview({ sim, rad, systems, alerts, today, onSelectSystem, onOpenAlert, onReport, goCheckin }) {
  const top = alerts[0];
  const onWatch = systems.filter((x) => x.status !== "ok");
  const barStatus = top ? top.status : onWatch.length ? "watch" : "ok";
  const overall = Math.round(systems.reduce((a, x) => a + x.score, 0) / systems.length);
  const by = Object.fromEntries(systems.map((x) => [x.key, x.status]));
  const cabin = worst(...["co2", "o2", "pressure", "temp", "humidity", "noise"].map((k) => classify(k, sim.env[k])));
  const hazards = [
    ["Radiation", rad.status],
    ["Isolation", by.mind],
    ["Distance", MISSIONS[sim.mission].commDelayMin > 1 ? "watch" : "ok"],
    ["Gravity", worst(by.brain, by.heart, by.bones)],
    ["Closed env.", worst(cabin, by.immune)],
  ];
  return (
    <>
      <div className={`statusbar ${barStatus}`} style={{ marginBottom: top ? 8 : 14 }}>
        {top ? <Icon name="alert" color={STATUS_COLOR[top.status]} /> : onWatch.length ? <Dot status="watch" /> : <Icon name="check" />}
        <span className="grow">
          {top
            ? <>{top.title}. <span style={{ fontWeight: 500 }}>{top.steps[0]}.</span></>
            : onWatch.length
              ? <>No active alerts. <span style={{ fontWeight: 500 }}>On watch: {onWatch.map((x) => x.name).join(", ")}.</span></>
              : "All systems nominal. Continue routine."}
          {alerts.length > 1 && <span className="muted"> · +{alerts.length - 1} more</span>}
        </span>
        {top && <button className="btn sm" onClick={() => onOpenAlert(top)}>What to do</button>}
        <button className="btn sm ghost" onClick={onReport}><Icon name="send" size={14} /> Earth report</button>
      </div>
      {top && <div style={{ marginBottom: 14 }}><Evidence keys={top.evidence} /></div>}
      <div className="grid overview">
        <div className="col">
          <RadiationCard sim={sim} rad={rad} />
          <CabinCard env={sim.env} />
        </div>
        <div className="col col-body">
          <Card title="Body Status" icon={<Icon name="body" />} sub="tap a system">
            <BodyFigure systems={systems} onSelect={onSelectSystem} />
            <div className="body-foot">
              <div>
                <div className="muted">Overall health</div>
                <div className="big mono" style={{ fontSize: 28 }}>{overall}<small>/100</small></div>
              </div>
              <div className="hazards" aria-label="NASA spaceflight hazards">
                {hazards.map(([h, st]) => <span key={h} className={`hz ${st}`}><Dot status={st} />{h}</span>)}
              </div>
            </div>
          </Card>
        </div>
        <div className="col">
          <VitalsCards sim={sim} />
          <Card title="Health Systems">
            <SystemsList systems={systems} onSelect={onSelectSystem} />
          </Card>
          {!today?.done && (
            <Card status="warn" onClick={goCheckin}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Icon name="pen" />
                <div style={{ flex: 1 }}>
                  <b>Daily check-in pending</b>
                  <div className="muted">Mood, sleep, symptoms · under 1 minute</div>
                </div>
                <span className="btn sm primary">Start</span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
