import { useState } from "react";
import { Card, Icon } from "../components/ui.jsx";
import { MoodFace, Emoji } from "../components/Emoji.jsx";
import { streak, TODAY } from "../../domain/history.js";

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

// Últimos 7 días del registro (vacíos hasta que el astronauta guarde su check-in)
const WEEK = Array.from({ length: 7 }, (_, i) => TODAY - 6 + i);
const TRACKS = [
  ["mood", "Mood", 5, "#14b8a6", (v) => `${v}/5`],
  ["sleep", "Sleep", 10, "#6366f1", (v) => `${v} h`],
  ["stress", "Stress", 5, "#f59e0b", (v) => `${v}/5`],
];

function Week({ history }) {
  const by = Object.fromEntries(history.map((d) => [d.day, d]));
  const today = by[TODAY];
  return (
    <>
      {!today && (
        <div className="start-log"><Icon name="pen" size={18} /><div><b>Start your log today</b><span>Save your first check-in and your mood, sleep and stress will appear here.</span></div></div>
      )}
      {TRACKS.map(([k, label, max, color, fmtV]) => (
        <div className="wk-row" key={k}>
          <div className="wk-lab"><span>{label}</span><b style={{ color: today ? color : undefined }}>{today ? fmtV(today[k]) : "—"}</b></div>
          <div className="wk-bars">
            {WEEK.map((d) => {
              const v = by[d]?.[k];
              return (
                <div key={d} className={`wk-col ${d === TODAY ? "today" : ""}`} title={v != null ? `Day ${d}: ${fmtV(v)}` : `Day ${d}: no entry`}>
                  <div className="wk-track"><i style={{ height: v != null ? `${Math.max(8, (v / max) * 100)}%` : 0, background: color }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="wk-days">{WEEK.map((d) => <span key={d} className={d === TODAY ? "today" : ""}>{d === TODAY ? "Today" : `D${d}`}</span>)}</div>
    </>
  );
}

function Badges({ history, st }) {
  const today = history.find((d) => d.day === TODAY);
  const list = [
    ["flame", "First log", !!today, "Save your first check-in"],
    ["satellite", `Week in orbit · ${Math.min(st, 7)}/7`, st >= 7, "Log 7 days in a row"],
    ["moon", "Sleep keeper", (today?.sleep ?? 0) >= 7, "Sleep 7 h or more"],
    ["sun", "Good vibes", (today?.mood ?? 0) >= 4, "Feel good or great"],
    ["muscle", "Calm & strong", !!today && today.stress <= 2 && today.energy >= 4, "Low stress, high energy"],
  ];
  const earned = list.filter((b) => b[2]).length;
  return (
    <>
      <p className="badge-sum">{today ? <><b>{earned}</b> of {list.length} badges earned today — keep logging to unlock the rest.</> : <>Start your log to earn badges. Your first check-in unlocks <b>First log</b>.</>}</p>
      <div className="badge-grid">
        {list.map(([icon, name, on, how]) => (
          <div key={name} className={`badge-item ${on ? "on" : ""}`} title={how}>
            <span className="badge-ico"><Emoji name={icon} size={24} /></span>
            <div><b>{name}</b><small>{on ? "Unlocked" : how}</small></div>
          </div>
        ))}
      </div>
    </>
  );
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
  const st = streak(history);

  return (
    <div className="two">
      <Card title={`Daily check-in · Day ${TODAY}`} icon={<Icon name="pen" />} right={<span className="chip"><Emoji name="flame" size={14} /> {st ? `${st}-day streak` : "Start your streak"}</span>}>
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
          {sent && <span className="c-ok" style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="tick" size={16} /> Saved — see your week and badges</span>}
        </div>
      </Card>

      <div className="col">
        <Card title="What this means">
          {guidance(e).map(([s, text]) => (
            <div className="insight" key={text}><span className={`dot ${s}`} style={{ marginTop: 6 }} /><span>{text}</span></div>
          ))}
        </Card>
        <Card title="Last 7 days" icon={<Icon name="chart" />}><Week history={history} /></Card>
        <Card title="Badges" icon={<Icon name="list" />}><Badges history={history} st={st} /></Card>
      </div>
    </div>
  );
}
