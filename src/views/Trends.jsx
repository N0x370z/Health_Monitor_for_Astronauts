import { Card, Sparkline, Evidence } from "../components/ui.jsx";
import { pearson, mean } from "../sim/analytics.js";
import { CAREER_LIMIT_MSV } from "../data/config.js";

function Trend({ title, data, unit, color, min, max, threshold, fmt = (v) => v }) {
  const last = data[data.length - 1];
  const avg = mean(data);
  return (
    <Card title={title} right={<span className="chip mono">{fmt(last)} {unit}</span>}>
      <Sparkline data={data} color={color} min={min} max={max} threshold={threshold} height={64} />
      <div className="muted" style={{ marginTop: 6 }}>7-day avg {fmt(+avg.toFixed(1))} {unit}</div>
    </Card>
  );
}

export default function Trends({ history }) {
  const h = history.slice(-14);
  const w = history.slice(-7);
  const insights = [];
  const rMoodHrv = pearson(h.map((d) => d.hrv), h.map((d) => d.mood));
  if (rMoodHrv > 0.4) insights.push(["watch", `Your mood follows your HRV (r = ${rMoodHrv.toFixed(2)}). Low HRV mornings are a good cue to slow down.`]);
  const headacheDays = h.filter((d) => d.symptoms?.includes("Headache"));
  if (headacheDays.length) {
    const co2H = mean(headacheDays.map((d) => d.co2));
    const co2N = mean(h.filter((d) => !d.symptoms?.includes("Headache")).map((d) => d.co2));
    if (co2H > co2N) insights.push(["warn", `Headache days had higher CO₂ (${co2H.toFixed(2)}% vs ${co2N.toFixed(2)}%). Your headaches may be environmental, not you.`]);
  }
  const shortSleep = w.filter((d) => d.sleep < 6.5).length;
  if (shortSleep >= 3) insights.push(["warn", `${shortSleep} of the last 7 nights under 6.5 h. Sleep debt affects mood, reaction time and immunity.`]);
  const rStress = pearson(h.map((d) => d.stress), h.map((d) => d.sleep));
  if (rStress < -0.3) insights.push(["watch", `High-stress days come with shorter sleep (r = ${rStress.toFixed(2)}).`]);
  const doseRate = (h[h.length - 1].dose - h[0].dose) / (h.length - 1);
  const daysLeft = (CAREER_LIMIT_MSV - h[h.length - 1].dose) / doseRate;
  insights.push(["ok", `Radiation: ~${doseRate.toFixed(2)} mSv/day. At this pace you would reach the career limit in ~${Math.round(daysLeft)} days.`]);

  return (
    <>
      <div className="three">
        <Trend title="Mood" data={h.map((d) => d.mood)} unit="/5" color="var(--teal)" min={1} max={5} />
        <Trend title="Sleep" data={h.map((d) => d.sleep)} unit="h" color="var(--indigo)" min={3} max={9} threshold={6.5} />
        <Trend title="HRV (morning)" data={h.map((d) => d.hrv)} unit="ms" color="var(--crit)" />
        <Trend title="Stress" data={h.map((d) => d.stress)} unit="/5" color="var(--warn)" min={1} max={5} />
        <Trend title="Cabin CO₂ (daily avg)" data={h.map((d) => d.co2)} unit="%" color="var(--yellow)" min={0.25} max={0.6} threshold={0.5} fmt={(v) => v.toFixed(2)} />
        <Trend title="Cumulative dose" data={h.map((d) => d.dose)} unit="mSv" color="var(--cyan)" fmt={(v) => v.toFixed(1)} />
      </div>
      <Card title="Insights (computed on board, no internet)" style={{ marginTop: 14 }}>
        {insights.map(([s, t]) => <div className="insight" key={t}><span className={`dot ${s}`} style={{ marginTop: 6 }} /><span>{t}</span></div>)}
      </Card>
      <div style={{ marginTop: 14 }}><Evidence keys={["sleepDur", "co2", "radSkylab"]} /></div>
    </>
  );
}
