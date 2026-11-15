// Monitor cardíaco — esquema de la referencia "Gestor de Salud":
// fila de KPIs en pastel · corazón (tarjeta azul marino) · hallazgos tipo "próximas citas" · métricas con control segmentado ·
// recordatorios · consejos (carrusel) · resumen con barras · tabla completa de ecocardiografía.
import { useState } from "react";
import { Card, Icon, Dot, Evidence, NoData } from "../components/ui.jsx";
import Heart from "../components/Heart.jsx";
import TimelineChart from "../components/TimelineChart.jsx";
import { TIMEPOINTS } from "../data/echo.js";
import { STATUS_COLOR, STATUS_LABEL } from "../data/config.js";
import { HM, fmt, reading, bestCountermeasure } from "../sim/heart.js";

const TABLE_KEYS = ["lvMass", "edv", "sv", "ef", "co", "hr", "vti", "fs", "ea", "ee", "tei", "rvS", "rvsp"];
const FIND_ICON = { lvMass: "heartLine", edv: "heartLine", lvidd: "heartLine", sv: "activity", co: "activity", vti: "activity", hr: "activity", ef: "heartLine", fs: "heartLine", ee: "stetho", ea: "stetho", mDt: "stetho", tei: "activity", rvS: "stetho", rvsp: "stetho" };

function Trend({ d, invert = false }) {
  if (d == null) return null;
  const good = invert ? d <= 0 : d >= 0;
  return (
    <span className={good ? "trend-up" : "trend-down"} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      <Icon name={d >= 0 ? "arrowUp" : "arrowDown"} size={13} />{Math.abs(d).toFixed(0)}%
    </span>
  );
}

function Kpis({ subject, tpKey, setTp, hs, playing, onPlay, live }) {
  const idx = TIMEPOINTS.findIndex((t) => t.key === tpKey);
  const tp = TIMEPOINTS[idx];
  const mass = reading(subject, tpKey, "lvMass");
  const hr = reading(subject, tpKey, "hr");
  const { best } = bestCountermeasure();
  const tpName = tp.key === "pre" ? "Pre bed rest" : tp.key.startsWith("d") ? `Bed rest ${tp.label}` : `Recovery ${tp.label}`;
  return (
    <div className="kpi-row">
      <div className={`kcard ${hs.score == null ? "k-err" : "k-pink"}`}>
        <div className="kicon"><Icon name="heartLine" size={28} /></div>
        <div className="kbody">
          <div className="klabel">Heart status</div>
          <div className="kval">{hs.score == null ? "Error" : STATUS_LABEL[hs.status]}</div>
          <div className="ksub">{hs.score == null ? "No echo data at this timepoint" : <>Score <b>{hs.score}</b>/100 · {hs.measured}/5 regions measured</>}</div>
        </div>
      </div>
      <div className="kcard k-blue" data-tour="timeline">
        <div className="kicon"><Icon name="calendar" size={28} /></div>
        <div className="kbody">
          <div className="klabel">Study timepoint</div>
          <div className="kval">{tpName}</div>
          <div className="ksub knav">
            <button onClick={() => setTp(TIMEPOINTS[idx - 1].key)} disabled={idx === 0} aria-label="Previous timepoint"><Icon name="chevronL" size={14} /></button>
            <button onClick={() => setTp(TIMEPOINTS[idx + 1].key)} disabled={idx === TIMEPOINTS.length - 1} aria-label="Next timepoint"><Icon name="chevron" size={14} /></button>
            <button className="knav-play" onClick={onPlay} aria-label={playing ? "Pause replay" : "Replay study"}>
              <Icon name={playing ? "pause" : "play"} size={11} color="var(--primary)" />{playing ? "Pause" : "Replay"}
            </button>
          </div>
        </div>
      </div>
      <div className="kcard k-green">
        <div className="kicon"><Icon name="dumbbell" size={28} /></div>
        <div className="kbody">
          <div className="klabel">Countermeasure</div>
          <div className="kval">{subject.treatment === "Control" ? "None" : subject.treatment}</div>
          <div className="ksub">{subject.treatment === "Control" ? <>Recommended: <b>{best}</b></> : mass.d != null ? <>LV mass <Trend d={mass.d} /> vs pre</> : <span className="err-val">LV mass: no data</span>}</div>
        </div>
      </div>
      <div className={`kcard ${live.hr == null ? "k-err" : "k-purple"}`} data-tour="pulse">
        <div className="kicon"><Icon name="activity" size={28} /></div>
        <div className="kbody">
          <div className="klabel">Pulse · SpO₂ <span className="live-badge sm"><i />LIVE SIM</span></div>
          <div className="kval">{live.hr == null ? "Error" : `${Math.round(live.hr)} bpm`} <span className="kval-2">· {Math.round(live.spo2)}%</span></div>
          <div className="ksub">{live.hr == null ? "No heart rate in the database" : hr.v != null ? <>DB {fmt("hr", hr.v)} bpm · <Trend d={hr.d} invert /> vs pre</> : <span className="err-val">DB: not measured here · using nearest</span>}</div>
        </div>
      </div>
    </div>
  );
}

function FindingsList({ findings, subject }) {
  const { best, g } = bestCountermeasure("lvMass", "d70");
  const items = findings.slice(0, 3);
  return (
    <div className="tl">
      {items.length === 0 && (
        <div className="tl-item"><span className="pin ok" /><div className="tl-ico ok"><Icon name="heartLine" size={24} /></div>
          <div><h4>All parameters in range</h4><p>No action needed at this timepoint.</p></div></div>
      )}
      {items.map((f) => {
        const [head, tail] = f.text.split(" — ");
        return (
          <div className="tl-item" key={f.k}>
            <span className={`pin ${f.status}`} />
            <div className={`tl-ico ${f.status}`}><Icon name={FIND_ICON[f.k] ?? "activity"} size={24} /></div>
            <div>
              <span className={`tag c-${f.status}`}>{STATUS_LABEL[f.status]} · {HM[f.k].short ?? HM[f.k].label}</span>
              <h4>{head}</h4>
              {tail && <p>{tail}</p>}
            </div>
          </div>
        );
      })}
      <div className="tl-item">
        <span className="pin" />
        <div className="tl-ico info"><Icon name="dumbbell" size={24} /></div>
        <div>
          <span className="tag" style={{ color: "#6d28d9" }}>Group evidence · D70</span>
          <h4>{best} kept LV mass at {g[best].mean.toFixed(1)}%</h4>
          <p>Control lost {Math.abs(g.Control.mean).toFixed(1)}%{subject.treatment !== "Control" && g[subject.treatment]?.mean != null ? ` · ${subject.treatment}: ${g[subject.treatment].mean.toFixed(1)}%` : ""}</p>
        </div>
      </div>
    </div>
  );
}

function Reminders({ chambers, subject }) {
  const weakest = [...chambers].filter((c) => c.score != null).sort((a, b) => a.score - b.score)[0] ?? chambers[0];
  const items = [
    { t: subject.treatment === "Control" ? "Start countermeasure exercise" : `${subject.treatment} session`, s: "Today · 30–45 min", icon: "dumbbell" },
    { t: "Drink water (2 L target)", s: "Today · supports plasma volume", icon: "water" },
    { t: weakest.measure[0], s: `${weakest.name} · next check`, icon: "stetho" },
  ];
  const [done, setDone] = useState({});
  const toggle = (i) => setDone((d) => ({ ...d, [i]: !d[i] }));
  return (
    <div>
      {items.map((it, i) => (
        <div key={it.t} className={`rem-item ${done[i] ? "done" : ""}`} role="checkbox" aria-checked={!!done[i]} tabIndex={0}
          onClick={() => toggle(i)} onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), toggle(i))}>
          <span className="rem-check">{done[i] && <Icon name="tick" size={14} />}</span>
          <div><h4>{it.t}</h4><p>{it.s}</p></div>
          <span className="rem-ico"><Icon name={it.icon} size={26} /></span>
        </div>
      ))}
    </div>
  );
}

const TIP_ART = ["heartLine", "water", "run"];

function Tips({ chambers }) {
  const tips = [...chambers].filter((c) => c.score != null).sort((a, b) => a.score - b.score).slice(0, 3)
    .map((c) => ({ title: c.actions[0], body: c.why.split(". ")[0] + ".", chamber: c.name, status: c.status }));
  const [i, setI] = useState(0);
  const [x0, setX0] = useState(null);
  const t = tips[i];
  if (!t) return <NoData what="No measured heart region at this timepoint to base a tip on." />;
  const go = (d) => setI((k) => (k + d + tips.length) % tips.length);
  // Deslizar en móvil
  const onTouchStart = (e) => setX0(e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    setX0(null);
  };
  return (
    <>
      <div className="tip" key={i} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="tip-art"><Icon name={TIP_ART[i]} size={50} color="var(--primary-2)" /></div>
        <div>
          <span className={`c-${t.status}`} style={{ fontSize: 12, fontWeight: 700 }}>{t.chamber}</span>
          <h4>{t.title}.</h4>
          <p>{t.body}</p>
        </div>
      </div>
      <div className="tip-nav">
        <button className="tip-arrow" onClick={() => go(-1)} aria-label="Previous tip" disabled={tips.length < 2}><Icon name="chevronL" size={18} /></button>
        <div className="dots" role="tablist" aria-label="Tips">
          {tips.map((_, k) => <button key={k} className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={`Tip ${k + 1}`} aria-selected={k === i} role="tab" />)}
        </div>
        <button className="tip-arrow" onClick={() => go(1)} aria-label="Next tip" disabled={tips.length < 2}><Icon name="chevron" size={18} /></button>
      </div>
    </>
  );
}

const SUM_ICON = { lv: "heartLine", mitral: "stetho", aortic: "activity", rv: "stetho", rhythm: "activity" };
const SUM_BG = { ok: "#ecf8f1", watch: "#e9f4fc", warn: "#fff3dc", crit: "#ffe4e9" };

function Summary({ hs, subject, tpKey, onSelect }) {
  const mass = reading(subject, tpKey, "lvMass");
  const pct = mass.v != null && mass.base ? (mass.v / mass.base) * 100 : null;
  return (
    <>
      {hs.chambers.map((c) => (
        <div key={c.key} className="sum-row" onClick={() => onSelect(c.key)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onSelect(c.key)}>
          <span className="ico" style={{ background: SUM_BG[c.status], color: STATUS_COLOR[c.status] }}><Icon name={SUM_ICON[c.key]} size={17} /></span>
          <div>
            <div className="top"><span>{c.name}</span>{c.score == null ? <span className="err-val">Error · no data</span> : <span>{STATUS_LABEL[c.status]} · {c.score}</span>}</div>
            <div className="bar"><i style={{ width: `${c.score ?? 0}%`, background: c.status === "ok" ? "var(--primary-2)" : STATUS_COLOR[c.status] }} /></div>
          </div>
        </div>
      ))}
      <div className="sum-row" style={{ cursor: "default" }}>
        <span className="ico" style={{ background: "#f3f0ff", color: "#6d28d9" }}><Icon name="heartLine" size={17} /></span>
        <div>
          <div className="top"><span>LV mass vs baseline</span>{pct == null ? <span className="err-val">Error · no data</span> : <span>{pct.toFixed(0)}%</span>}</div>
          <div className="bar"><i style={{ width: `${pct == null ? 0 : Math.min(100, Math.max(0, ((pct - 70) / 40) * 100))}%`, background: "#8b5cf6" }} /></div>
        </div>
      </div>
    </>
  );
}

function EchoTable({ subject, tpKey, onSelectTp }) {
  return (
    <div className="etable-wrap">
      <table className="etable">
        <thead>
          <tr>
            <th>Metric</th>
            {TIMEPOINTS.map((t) => (
              <th key={t.key} className={t.key === tpKey ? "cur" : ""} onClick={() => onSelectTp(t.key)} title={t.long}>{t.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_KEYS.map((k) => (
            <tr key={k}>
              <td className="mname">{HM[k].short ?? HM[k].label}<small>{HM[k].unit}</small></td>
              {TIMEPOINTS.map((t) => {
                const v = subject.tp[t.key]?.[k];
                const s = v == null ? "err" : reading(subject, t.key, k).status;
                const src = subject.filled[t.key]?.[k];
                return (
                  <td key={t.key} className={`cell s-${s} ${src ? "filled" : ""} ${t.key === tpKey ? "cur" : ""}`} onClick={() => onSelectTp(t.key)} title={src ? `Completed from ${src}` : v == null ? "Error: not in the database" : undefined}>
                    {v == null ? "ERR" : fmt(k, v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CHART_MODES = [["all", "All"], ["size", "Size"], ["flow", "Flow"]];

export default function HeartMonitor({ subject, tpKey, setTp, hs, findings, onSelectChamber, selectedChamber, playing, onPlay, live }) {
  const [mode, setMode] = useState("all");
  const r = (k) => reading(subject, tpKey, k);
  const ef = r("ef"), co = r("co"), hr = r("hr");

  return (
    <>
      <Kpis subject={subject} tpKey={tpKey} setTp={setTp} hs={hs} playing={playing} onPlay={onPlay} live={live} />

      <div className="hm">
        <Card className="hm-heart navy" title="Cardiac status" icon={<Icon name="heartLine" />}
          right={<span className="card-sub" style={{ color: "#9fb3d6" }}>tap a region</span>}>
          <Heart chambers={hs.chambers} selected={selectedChamber} onSelect={onSelectChamber} hr={live.hr} />
          <div className="heart-meta">
            {[["EF", ef, "%"], ["CO", co, "L/min"], ["Pulse", { k: "hr", v: live.hr, status: hr.status, live: true }, "bpm"], ["SpO₂", { k: "spo2", v: live.spo2, status: "ok", live: true }, "%"]].map(([lab, x, u]) => (
              <div key={lab}>
                {x.v == null
                  ? <b style={{ color: "#fda29b" }}>Error</b>
                  : <b>{x.live ? Math.round(x.v) : fmt(x.k, x.v)}<small style={{ fontSize: 11, fontWeight: 600, color: "#9fb3d6", marginLeft: 3 }}>{u}</small></b>}
                <span>{x.live ? <span className="live-dot" /> : <Dot status={x.status === "none" ? "ok" : x.status} />} {lab}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="hm-find" title="Findings" icon={<Icon name="list" />}
>
          <FindingsList findings={findings} subject={subject} />
          {findings.length > 3 && <p className="muted" style={{ margin: "8px 0 0" }}>+{findings.length - 3} more findings — tap a heart region for details</p>}
        </Card>

        <Card className="hm-chart" title="Your metrics" icon={<Icon name="chart" />}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <div className="seg" role="tablist" aria-label="Metric group">
              {CHART_MODES.map(([k, l]) => <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
            </div>
          </div>
          <TimelineChart subject={subject} tpKey={tpKey} onSelect={setTp} mode={mode} />
        </Card>

        <Card className="hm-rem" title="Reminders" icon={<Icon name="bell" />}>
          <Reminders chambers={hs.chambers} subject={subject} />
        </Card>

        <Card className="hm-tips" title="Health tips" icon={<Icon name="bulb" />}>
          <Tips chambers={hs.chambers} key={subject.id + tpKey} />
        </Card>

        <Card className="hm-sum" title="Your heart at a glance" icon={<Icon name="heartLine" />}>
          <Summary hs={hs} subject={subject} tpKey={tpKey} onSelect={onSelectChamber} />
        </Card>

        <Card className="hm-table" title="Echocardiography" icon={<Icon name="calendar" />} sub="2D · Doppler · TDI · 3D — click a column to jump">
          <EchoTable subject={subject} tpKey={tpKey} onSelectTp={setTp} />
        </Card>
      </div>
      <div style={{ marginTop: 16 }}><Evidence keys={["echoAll", "echo3d"]} /></div>
    </>
  );
}
