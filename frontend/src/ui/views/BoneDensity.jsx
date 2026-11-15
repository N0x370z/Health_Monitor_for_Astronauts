// Pantalla de densidad ósea: qué huesos pierden densidad en reposo en cama y la línea de tiempo de cada sujeto.
import { useEffect, useMemo, useState } from "react";
import { Card, Evidence, Icon, NoData } from "../components/ui.jsx";
import { loadBoneSubject, loadBoneSubjects, loadBoneSummary } from "../../data/bone.js";
import {
  BONE_STATUS_LABEL, CAMPAIGN_LABEL, ROLE_LABEL, boneStatus, fmtP, signedPct, visitLabel,
} from "../../domain/bone.js";

const SCALE = 4; // ± % que cubre cada barra

/** Barras divergentes: cambio medio de BMD por región, IC 95 % y franja del error del densitómetro (±LSC). */
function RegionBars({ regions }) {
  return (
    <div className="bbars" role="list">
      {regions.map((r) => {
        const m = r.mean_pct_change;
        const sig = r.p_vs_baseline != null && r.p_vs_baseline < 0.05;
        const color = !sig ? "var(--text-3)" : m < 0 ? "var(--crit)" : "var(--watch)";
        const x = (v) => 50 + (Math.max(-SCALE, Math.min(SCALE, v)) / SCALE) * 50;
        const [lo, hi] = r.ci95_pct_change ?? [m, m];
        const tip = `${r.name}: ${signedPct(m, 2)} (95% CI ${signedPct(lo, 2)} to ${signedPct(hi, 2)}), ${fmtP(r.p_vs_baseline)}, n=${r.n}. `
          + `Scanner error ±${r.lsc_pct}%. ${r.pct_subjects_beyond_lsc}% of subjects lost more than that.`;
        return (
          <div className="bbar" role="listitem" key={r.region_code} title={tip}>
            <span className="bname">{r.name}<small className={`role role-${r.role}`}>{ROLE_LABEL[r.role]}</small></span>
            <div className="btrack" aria-hidden="true">
              <span className="blsc" style={{ left: `${x(-r.lsc_pct)}%`, width: `${x(r.lsc_pct) - x(-r.lsc_pct)}%` }} />
              <span className="gzero" />
              <i style={{ left: `${Math.min(x(0), x(m))}%`, width: `${Math.abs(x(m) - x(0))}%`, background: color }} />
              <span className="bci" style={{ left: `${x(lo)}%`, width: `${Math.max(0.5, x(hi) - x(lo))}%` }} />
            </div>
            <span className="bval">
              <b className="mono">{signedPct(m)}</b>
              <small>{sig ? fmtP(r.p_vs_baseline) : "not significant"}</small>
            </span>
          </div>
        );
      })}
      <div className="bbar baxis" aria-hidden="true">
        <span />
        <div className="baxis-ticks"><span>−{SCALE}%</span><span>0</span><span>+{SCALE}%</span></div>
        <span />
      </div>
    </div>
  );
}

function SubjectTimeline({ detail }) {
  const visits = useMemo(() => {
    const order = [];
    for (const r of detail.regions) for (const v of r.visits) if (!order.includes(v.visit_code)) order.push(v.visit_code);
    return order;
  }, [detail]);
  return (
    <div className="etable-wrap">
      <table className="etable">
        <thead>
          <tr><th>Region</th>{visits.map((v) => <th key={v}>{visitLabel(v)}</th>)}<th>Z-score</th></tr>
        </thead>
        <tbody>
          {detail.regions.map((r) => {
            const byVisit = Object.fromEntries(r.visits.map((v) => [v.visit_code, v]));
            const z = [...r.visits].reverse().find((v) => v.z_score != null);
            return (
              <tr key={r.region_code}>
                <td className="mname">{r.name}<small className={`role role-${r.role}`}>{ROLE_LABEL[r.role]}</small></td>
                {visits.map((v) => {
                  const c = byVisit[v];
                  if (!c || c.bmd == null) return <td key={v} className="s-none">·</td>;
                  if (v === "PRE" || c.pct_change_from_pre == null) {
                    return <td key={v} className="s-none" title={`BMD ${c.bmd} g/cm²`}>{c.bmd.toFixed(3)}</td>;
                  }
                  const st = boneStatus(c.pct_change_from_pre, r.lsc_pct);
                  return (
                    <td key={v} className={`s-${st}`} title={`BMD ${c.bmd} g/cm² · ${BONE_STATUS_LABEL[st]} (LSC ${r.lsc_pct}%)`}>
                      {signedPct(c.pct_change_from_pre)}
                    </td>
                  );
                })}
                <td className={z?.z_category === "below_expected" ? "s-crit" : "s-none"} title={z ? `Z-score at ${visitLabel(z.visit_code)}` : "No Z-score in the files"}>
                  {z ? z.z_score.toFixed(1) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function BoneDensity() {
  const [summary, setSummary] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [code, setCode] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadBoneSummary(), loadBoneSubjects()])
      .then(([s, list]) => {
        if (!alive) return;
        setSummary(s);
        setSubjects(list);
        setCode((list.find((x) => x.campaign_code === "UTMB_C3" && x.total_hip_pct_change != null) ?? list[0])?.subject_code ?? null);
      })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    loadBoneSubject(code).then((d) => alive && setDetail(d)).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [code]);

  if (error) return <NoData what={`Bone density comes from the database through the API, which is not available (${error}). Start the backend: cd backend && npm start.`} />;
  if (!summary) return <p className="muted" role="status">Loading bone density…</p>;

  const byCode = Object.fromEntries(summary.regions.map((r) => [r.region_code, r]));
  const ranked = summary.ranking.map((x) => byCode[x.region_code]);
  const top = ranked[0];
  const control = byCode.FOREARM_13;
  const total = summary.campaigns.reduce((a, c) => a + c.subjects, 0);
  const groups = summary.campaigns.map((c) => ({ ...c, list: subjects.filter((s) => s.campaign_code === c.campaign_code) }));
  const sel = subjects.find((s) => s.subject_code === code);

  return (
    <>
      <div className="kpi-row" data-tour="bone-kpis">
        <div className="kcard k-pink"><div className="kicon"><Icon name="alert" size={28} /></div><div className="kbody">
          <div className="klabel">Biggest bone loss</div><div className="kval">{signedPct(top.mean_pct_change)}</div>
          <div className="ksub">{top.name} after bed rest</div></div></div>
        <div className="kcard k-blue"><div className="kicon"><Icon name="shield" size={28} /></div><div className="kbody">
          <div className="klabel">Beyond scanner error</div><div className="kval">{top.pct_subjects_beyond_lsc}%</div>
          <div className="ksub">of subjects lost more than {top.lsc_pct}%</div></div></div>
        <div className="kcard k-green"><div className="kicon"><Icon name="check" size={28} /></div><div className="kbody">
          <div className="klabel">Control site</div><div className="kval">{signedPct(control.mean_pct_change)}</div>
          <div className="ksub">Forearm: no load, no change</div></div></div>
        <div className="kcard k-purple"><div className="kicon"><Icon name="user" size={28} /></div><div className="kbody">
          <div className="klabel">Subjects</div><div className="kval">{total}</div>
          <div className="ksub">{summary.campaigns.length} bed rest campaigns · DXA</div></div></div>
      </div>

      <div className="two">
        <Card title="Which bones lose density" icon={<Icon name="chart" />} sub={`PRE → end of bed rest · n=${top.n}`} className="bone-chart">
          <div data-tour="bone-chart"><RegionBars regions={ranked} /></div>
          <div className="legend">
            <span><i style={{ background: "var(--crit)" }} />Significant loss (p &lt; 0.05)</span>
            <span><i style={{ background: "var(--text-3)" }} />No significant change</span>
            <span><i className="legend-lsc" />Scanner error (±LSC)</span>
            <span><i className="legend-ci" />95% CI</span>
          </div>
        </Card>

        <Card title="What to watch" icon={<Icon name="bulb" />}>
          <div data-tour="bone-params">
            <div className="insight"><span className="dot crit" style={{ marginTop: 6 }} /><span>
              <b>Key structures:</b> {ranked.filter((r) => r.role === "key").map((r) => r.name).join(", ")}. They carry body weight, so they lose bone without gravity.
            </span></div>
            <div className="insight"><span className="dot ok" style={{ marginTop: 6 }} /><span>
              <b>Controls:</b> forearm and arms do not carry weight and do not change. A loss there points to another cause.
            </span></div>
            <div className="insight"><span className="dot watch" style={{ marginTop: 6 }} /><span>
              <b>Parameters:</b> follow <b>BMD</b> as % change from your own Pre value, and count it as real only beyond the scanner error (LSC).
              Use the <b>Z-score</b> for young adults (≤ −2.0 is below the expected range for age).
            </span></div>
          </div>
        </Card>
      </div>

      <Card title="Subject timeline" icon={<Icon name="calendar" />} sub="% change of BMD from Pre at each visit" style={{ marginTop: 18 }}
        right={(
          <select className="chip bone-select" data-tour="bone-subject" value={code ?? ""} onChange={(e) => setCode(e.target.value)} aria-label="Bone subject">
            {groups.map((g) => (
              <optgroup key={g.campaign_code} label={`${CAMPAIGN_LABEL[g.campaign_code] ?? g.campaign_code} (${g.list.length})`}>
                {g.list.map((s) => <option key={s.subject_code} value={s.subject_code}>{s.subject_code} · {s.sex === "F" ? "F" : "M"}</option>)}
              </optgroup>
            ))}
          </select>
        )}>
        {sel && (
          <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>
            {CAMPAIGN_LABEL[sel.campaign_code]}{sel.cohort ? ` · cohort ${sel.cohort}` : ""} ·{" "}
            {sel.key_regions_with_loss.length ? `real loss at ${sel.key_regions_with_loss.length} key region(s)` : "no key region beyond scanner error"}
            {detail && !detail.campaign?.has_phases ? " · visits numbered by date (the files have no bed rest phase)" : ""}
          </p>
        )}
        <div data-tour="bone-table">{detail ? <SubjectTimeline detail={detail} /> : <p className="muted">Loading…</p>}</div>
        <div className="legend">
          {["crit", "warn", "ok", "watch"].map((s) => <span key={s}><i className={`legend-cell s-${s}`} />{BONE_STATUS_LABEL[s]}</span>)}
          <span>Pre column: BMD in g/cm²</span>
        </div>
      </Card>
      <div style={{ marginTop: 14 }}><Evidence keys={["boneDxa"]} /></div>
    </>
  );
}
