import { useState } from "react";
import { Card, Icon, Sparkline, NoData } from "../components/ui.jsx";
import { DATA_ONLY } from "../data/config.js";
import { MoodFace, Emoji } from "../components/Emoji.jsx";
import { streak, TODAY } from "../sim/history.js";

const MOODS = [1, 2, 3, 4, 5];
const SYMPTOMS = ["Headache", "Nausea", "Back pain", "Congestion", "Sore throat", "Rash", "Vision changes", "Insomnia", "Anxiety", "Irritability"];

function guidance(e) {
  const g = [];
  if (e.symptoms.includes("Vision changes")) g.push(["crit", "Vision changes can be an early sign of SANS. Do an Amsler grid test now and notify the flight surgeon."]);
  if (e.symptoms.includes("Headache")) g.push(["warn", "Headaches often follow high cabin CO₂. Check the CO₂ reading and hydrate."]);
  if (e.sleep < 6) g.push(["warn", `Only ${e.sleep} h of sleep. Plan a 20-min nap before 15:00 and keep tonight's sleep window.`]);
  if (e.mood <= 2 || e.stress >= 4) g.push(["warn", "Tough day. Consider a private call with family or psych support, and a short break with a crewmate."]);
  if (e.social <= 2) g.push(["watch", "Low social connection. Join the crew meal or schedule leisure time together."]);
  if (["Congestion", "Sore throat", "Rash"].some((s) => e.symptoms.includes(s))) g.push(["warn", "Possible infection signs. Take body temperature and log again in 2 h."]);
  if (!g.length) g.push(["ok", "Everything looks good. Keep your routine — great job logging today!"]);
  return g;
}

function Slider({ label, hint, value, onChange, min = 1, max = 5, step = 1, fmt = (v) => `${v}/5` }) {
  return (
    <div className="field">
      <label>{label} <span className="hint">{fmt(value)}</span></label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} aria-label={label} style={{ "--p": `${((value - min) / (max - min)) * 100}%` }} />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export default function CheckIn({ history, onSubmit }) {
  const today = history.find((d) => d.day === TODAY);
  const [e, setE] = useState(() => today ?? { mood: 3, stress: 3, energy: 3, social: 3, sleep: 6.5, sleepQuality: 3, symptoms: [], note: "" });
  const [sent, setSent] = useState(!!today?.done);
  const set = (k) => (v) => { setE((x) => ({ ...x, [k]: v })); setSent(false); };
  const toggle = (s) => set("symptoms")(e.symptoms.includes(s) ? e.symptoms.filter((x) => x !== s) : [...e.symptoms, s]);
  const st = streak(history) + (today?.done ? 0 : 0);
  const last7 = history.slice(-7);

  return (
    <div className="two">
      <Card title={`Daily check-in · Day ${TODAY}`} icon={<Icon name="pen" />} right={DATA_ONLY ? <span className="chip">Manual entry · not in study database</span> : <span className="chip"><Emoji name="flame" size={14} /> {st} day streak</span>}>
        <div className="field">
          <label>How do you feel today?</label>
          <div className="moods" role="radiogroup" aria-label="Mood">
            {MOODS.map((m, i) => (
              <button key={m} className={`mood ${e.mood === i + 1 ? "sel" : ""}`} onClick={() => set("mood")(i + 1)} role="radio" aria-checked={e.mood === i + 1} aria-label={`Mood ${i + 1}`}><MoodFace level={m} size={32} /></button>
            ))}
          </div>
        </div>
        <Slider label="Stress" value={e.stress} onChange={set("stress")} hint="1 = calm · 5 = overwhelmed" />
        <Slider label="Energy" value={e.energy} onChange={set("energy")} />
        <Slider label="Connection with crew & family" value={e.social} onChange={set("social")} />
        <Slider label="Hours of sleep" value={e.sleep} onChange={set("sleep")} min={0} max={10} step={0.5} fmt={(v) => `${v} h`} />
        <Slider label="Sleep quality" value={e.sleepQuality} onChange={set("sleepQuality")} />
        <div className="field">
          <label>Symptoms <span className="hint">tap all that apply</span></label>
          <div className="chips">
            {SYMPTOMS.map((s) => <button key={s} className={`tog ${e.symptoms.includes(s) ? "on" : ""}`} onClick={() => toggle(s)} aria-pressed={e.symptoms.includes(s)}>{s}</button>)}
          </div>
        </div>
        <div className="field">
          <label>Journal note <span className="hint">private · optional</span></label>
          <textarea value={e.note} onChange={(ev) => set("note")(ev.target.value)} placeholder="Anything on your mind today?" />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
          <button className="btn primary" onClick={() => { onSubmit(e); setSent(true); }}>{today?.done ? "Update check-in" : "Save check-in"}</button>
          {sent && <span className="c-ok" style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="tick" size={16} /> Saved locally (offline)</span>}
        </div>
      </Card>

      <div className="col">
        <Card title="What this means">
          {guidance(e).map(([s, text]) => (
            <div className="insight" key={text}><span className={`dot ${s}`} style={{ marginTop: 6 }} /><span>{text}</span></div>
          ))}
        </Card>
        {DATA_ONLY ? (
          <>
            <Card title="Last 7 days" icon={<Icon name="chart" />}><NoData what="Mood, sleep and stress history are not recorded in the CFT70 echo database." /></Card>
            <Card title="Badges" icon={<Icon name="list" />}><NoData what="Streaks and badges need a daily log history, which the database does not contain." /></Card>
          </>
        ) : (
          <>
            <Card title="Last 7 days">
          <div className="muted">Mood</div>
          <Sparkline data={last7.map((d) => d.mood)} min={1} max={5} color="var(--teal)" height={36} />
          <div className="muted" style={{ marginTop: 8 }}>Sleep (h)</div>
          <Sparkline data={last7.map((d) => d.sleep)} min={3} max={9} color="var(--indigo)" height={36} threshold={6} />
          <div className="muted" style={{ marginTop: 8 }}>Stress</div>
          <Sparkline data={last7.map((d) => d.stress)} min={1} max={5} color="var(--warn)" height={36} />
        </Card>
            <Card title="Badges">
          <div className="chips">
            <span className="tog on badge"><Emoji name="flame" /> {st}-day streak</span>
            <span className={`tog badge ${st >= 7 ? "on" : ""}`}><Emoji name="satellite" /> Week in orbit</span>
            <span className={`tog badge ${last7.filter((d) => d.sleep >= 7).length >= 3 ? "on" : ""}`}><Emoji name="moon" /> Sleep keeper</span>
            <span className={`tog badge ${last7.every((d) => (d.exerciseMin || 0) >= 90) ? "on" : ""}`}><Emoji name="muscle" /> Bone guardian</span>
          </div>
        </Card>
          </>
        )}
      </div>
    </div>
  );
}
