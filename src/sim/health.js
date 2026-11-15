// Motor de reglas: convierte mediciones en alertas, sistemas del cuerpo y acciones.
import { classify, worst, CAREER_LIMIT_MSV, METRICS, SHELTER_TRANSIT_MIN, AIRLOCK_TRANSIT_MIN, MISSIONS } from "../data/config.js";
import { detectExponential, minutesUntil, ratePerMin, fmtMin } from "./analytics.js";

const CRIT_RATE = METRICS.radRate.crit[1];

export function radiationAnalysis(sim) {
  const exp = detectExponential(sim.hist.radRate);
  const rate = sim.env.radRate;
  let status = classify("radRate", rate);
  let timeToCrit = Infinity;
  if (exp.exponential) {
    status = worst(status, "warn");
    timeToCrit = minutesUntil(rate, CRIT_RATE, exp.slope);
    if (timeToCrit < 20) status = "crit";
  }
  if (sim.sheltered && status !== "ok") status = rate > CRIT_RATE ? "warn" : "watch";
  const careerPct = (sim.doseMsv / CAREER_LIMIT_MSV) * 100;
  return { rate, status, exp, timeToCrit, careerPct };
}

export function buildAlerts(sim, today) {
  const alerts = [];
  const rad = radiationAnalysis(sim);
  const delay = MISSIONS[sim.mission].earthLink;

  if (rad.exp.exponential && !sim.sheltered) {
    const eva = sim.eva.active;
    const transit = eva ? AIRLOCK_TRANSIT_MIN : SHELTER_TRANSIT_MIN;
    alerts.push({
      id: "rad-exp",
      status: rad.timeToCrit - transit < 10 ? "crit" : "warn",
      hazard: "Radiation",
      title: "Exponential radiation rise detected",
      detail: `Dose rate doubling every ${rad.exp.doublingMin.toFixed(1)} min (fit R² ${rad.exp.r2.toFixed(2)}). Critical level (${CRIT_RATE} µSv/h) in ~${fmtMin(rad.timeToCrit)}.`,
      steps: eva
        ? ["Abort EVA — return to airlock now", `Airlock transit ≈ ${AIRLOCK_TRANSIT_MIN} min`, "Keep partner in sight, tether check", "Log symptoms after ingress"]
        : ["Move to the shielded shelter (water-wall sleep station)", "Notify the rest of the crew", "Stay until the dose rate falls back to baseline", "Log any symptoms (nausea, fatigue)"],
      action: eva ? null : { label: "I'm in the shelter", type: "shelter" },
      evidence: ["radSkylab", "radMir"],
    });
  } else if (rad.status !== "ok") {
    alerts.push({
      id: "rad-high", status: rad.status, hazard: "Radiation",
      title: sim.sheltered ? "Sheltered — radiation still elevated" : "Elevated dose rate",
      detail: `${Math.round(rad.rate)} µSv/h vs baseline ${MISSIONS[sim.mission].baseRad} µSv/h.`,
      steps: sim.sheltered ? ["Remain in shelter until rate returns to baseline"] : ["Limit time in low-shielding modules", "Postpone non-critical EVA"],
      action: sim.sheltered ? { label: "Leave shelter", type: "unshelter" } : null,
      evidence: ["radMir"],
    });
  }

  const co2s = classify("co2", sim.env.co2);
  if (co2s !== "ok") {
    const r = ratePerMin(sim.hist.co2);
    alerts.push({
      id: "co2", status: co2s, hazard: "Hostile/Closed Environment",
      title: "Cabin CO₂ above limit",
      detail: `CO₂ ${sim.env.co2.toFixed(2)}% (${(sim.env.co2 * 7.6).toFixed(1)} mmHg)${r > 0.005 ? `, rising ${(r * 60).toFixed(2)}%/h` : ""}. High CO₂ causes headache, fatigue and slower thinking.`,
      steps: ["Check CO₂ scrubber (CDRA) status", "Increase ventilation / move to a ventilated module", "Avoid strenuous exercise until normal", "Note headaches in the daily log"],
      evidence: ["co2"],
    });
  }

  const spo2s = classify("spo2", sim.vitals.spo2);
  if (spo2s !== "ok") alerts.push({ id: "spo2", status: spo2s, hazard: "Hostile/Closed Environment", title: "Low blood oxygen", detail: `SpO₂ ${sim.vitals.spo2.toFixed(0)}%.`, steps: ["Rest and re-measure in 5 min", "Check cabin O₂ and suit/mask fit", "If < 92%: notify flight surgeon"], evidence: [] });

  const hrs = classify("hr", sim.vitals.hr);
  if (hrs !== "ok" && !sim.eva.active) alerts.push({ id: "hr", status: hrs, hazard: "Gravity Fields", title: "Resting heart rate out of range", detail: `${Math.round(sim.vitals.hr)} bpm at rest.`, steps: ["Sit, breathe slowly for 2 min, re-measure", "Hydrate (fluid shift in microgravity)", "If persists: run ECG and notify flight surgeon"], evidence: ["holter"] });

  const ts = classify("bodyTemp", sim.vitals.bodyTemp);
  if (ts !== "ok") alerts.push({ id: "temp", status: ts, hazard: "Hostile/Closed Environment", title: "Body temperature elevated", detail: `${sim.vitals.bodyTemp.toFixed(1)} °C — possible infection (immune changes in spaceflight can reactivate latent viruses).`, steps: ["Log symptoms (rash, sore throat)", "Rest and hydrate", "Re-check in 2 h; if > 38.3 °C start medical kit protocol"], evidence: ["immune"] });

  if (today?.done && today.symptoms?.includes("Vision changes")) alerts.push({ id: "sans", status: "warn", hazard: "Gravity Fields", title: "Vision changes reported (possible SANS)", detail: "Blurred near vision or visual changes can be an early sign of Spaceflight Associated Neuro-ocular Syndrome.", steps: ["Do the Amsler grid test for each eye now", "Check visual acuity chart", "Notify the flight surgeon in the next report", "Keep cabin CO₂ below 0.5%"], evidence: ["sans"] });

  const lowSleep = sim.sleepLastNight < 5.5;
  const lowMood = today?.done && today.mood <= 2;
  if (lowSleep || lowMood) alerts.push({ id: "mind", status: "warn", hazard: "Isolation & Confinement", title: lowSleep && lowMood ? "Sleep debt & low mood" : lowSleep ? "Sleep debt detected" : "Low mood reported", detail: `Slept ${sim.sleepLastNight} h${today?.done ? `, mood ${today.mood}/5` : ""}. HRV ${Math.round(sim.vitals.hrv)} ms is below your baseline.`, steps: ["Schedule a 20-min nap before 15:00", "Dim lights and screens 1 h before sleep", "Book a private call with family / psych support", "Light exercise: 20 min cycle ergometer"], evidence: ["sleepDur", "mood"] });

  if (sim.eva.active) {
    const left = Math.min(sim.eva.plannedMin - (sim.t - sim.eva.start), (sim.eva.o2Pct / 100) * 450);
    if (left < 30) alerts.push({ id: "eva-time", status: left < 15 ? "crit" : "warn", hazard: "Hostile/Closed Environment", title: "EVA consumables low", detail: `≈ ${fmtMin(left)} remaining. Airlock transit ${AIRLOCK_TRANSIT_MIN} min.`, steps: ["Begin return to airlock"], evidence: [] });
  }

  const order = { crit: 0, warn: 1, watch: 2, ok: 3 };
  alerts.sort((a, b) => order[a.status] - order[b.status]);
  return { alerts, rad, delay };
}

const score = (status, base = 92) => ({ ok: base, watch: 72, warn: 48, crit: 20 }[status]);

export function buildSystems(sim, today, history) {
  const v = sim.vitals;
  const missionDay = 182;
  const exerciseAvg = history.slice(-7).reduce((a, d) => a + (d.exerciseMin || 0), 0) / Math.max(1, history.slice(-7).length);

  const heartS = worst(classify("hr", sim.eva.active ? 80 : v.hr), classify("sys", v.sys), classify("dia", v.dia), classify("hrv", v.hrv));
  const sansS = worst(sim.env.co2 > 0.5 ? "warn" : "ok", today?.symptoms?.includes("Vision changes") ? "warn" : "watch");
  const boneLoss = Math.max(0.4, 1.4 - (exerciseAvg - 60) / 100); // %/mes estimado
  const boneS = exerciseAvg < 90 ? "warn" : boneLoss > 1 ? "watch" : "ok";
  const immS = worst(classify("bodyTemp", v.bodyTemp), today?.symptoms?.some((s) => ["Congestion", "Sore throat", "Rash"].includes(s)) ? "warn" : "ok");
  const sleepS = sim.sleepLastNight < 5.5 ? "warn" : sim.sleepLastNight < 6.5 ? "watch" : "ok";
  const mindS = worst(sleepS, today?.done ? (today.mood <= 2 || today.stress >= 4 ? "warn" : today.mood === 3 ? "watch" : "ok") : "watch", classify("hrv", v.hrv) === "ok" ? "ok" : "watch");

  return [
    {
      key: "brain", name: "Brain / Eyes", sub: "SANS · neuro-ocular", status: sansS, score: score(sansS, 86),
      risk: "Spaceflight Associated Neuro-ocular Syndrome (SANS)", hazard: "Gravity Fields",
      why: "Without gravity, fluids shift toward the head. Over months this can swell the optic nerve and flatten the back of the eye. High CO₂ may make it worse.",
      metrics: [["Mission day", `${missionDay}`], ["Last ocular check", "Day 175"], ["Cabin CO₂", `${sim.env.co2.toFixed(2)} %`], ["Vision symptoms", today?.symptoms?.includes("Vision changes") ? "Reported" : "None"]],
      measure: ["Weekly Amsler grid test (2 min per eye)", "Monthly visual acuity chart", "Optical coherence tomography (OCT) if symptoms appear"],
      actions: ["Report any blurred near vision immediately", "Keep CO₂ < 0.5%", "Use lower-body negative pressure session if prescribed"],
      evidence: ["sans", "co2"],
    },
    {
      key: "heart", name: "Heart", sub: "Cardiovascular", status: heartS, score: score(heartS, 90),
      risk: "Cardiovascular Adaptations", hazard: "Gravity Fields",
      why: "The heart works less in microgravity and can lose mass; blood volume drops. Radiation may add long-term risk.",
      metrics: [["Heart rate", `${Math.round(v.hr)} bpm`], ["HRV", `${Math.round(v.hrv)} ms`], ["Blood pressure", `${Math.round(v.sys)}/${Math.round(v.dia)} mmHg`], ["Resp. rate", `${v.rr.toFixed(0)} /min`]],
      measure: ["Wearable HR/HRV continuous", "BP cuff every morning, seated, after 5 min rest", "Weekly 12-lead ECG"],
      actions: ["Hydrate 2–2.5 L/day", "Keep aerobic exercise ≥ 30 min/day", "Report palpitations or dizziness"],
      evidence: ["holter", "bp"],
    },
    {
      key: "bones", name: "Bones & Muscles", sub: "Musculoskeletal", status: boneS, score: score(boneS, 84),
      risk: "Spaceflight-Induced Bone Changes", hazard: "Gravity Fields",
      why: "Without load, bones lose ~1–1.5% mineral density per month (hip, spine). Resistance exercise is the main countermeasure.",
      metrics: [["Exercise (7-day avg)", `${Math.round(exerciseAvg)} min/day`], ["Est. bone loss", `${boneLoss.toFixed(1)} %/month`], ["Target", "≥ 120 min/day"]],
      measure: ["Log exercise sessions (ARED, treadmill, cycle)", "Monthly urine calcium", "DXA scan pre/post mission"],
      actions: ["Resistance training 6 days/week", "Vitamin D + calcium per diet plan", "Avoid skipping ARED sessions"],
      evidence: ["bone"],
    },
    {
      key: "immune", name: "Immune", sub: "Immune system", status: immS, score: score(immS, 88),
      risk: "Altered Immune System Responses", hazard: "Hostile/Closed Environment",
      why: "Stress, radiation and the closed environment weaken immunity and can reactivate dormant viruses (rashes, cold sores).",
      metrics: [["Body temp", `${v.bodyTemp.toFixed(1)} °C`], ["Symptoms today", today?.symptoms?.length ? today.symptoms.join(", ") : "None"], ["Sleep last night", `${sim.sleepLastNight} h`]],
      measure: ["Body temperature each morning", "Daily symptom check-in", "Saliva/blood sample per medical schedule"],
      actions: ["Hand hygiene and surface wipes", "Prioritize sleep", "Report skin rashes early"],
      evidence: ["immune"],
    },
    {
      key: "mind", name: "Mind & Sleep", sub: "Behavioral health", status: mindS, score: score(mindS, 85),
      risk: "Behavioral Conditions · Inadequate Sleep", hazard: "Isolation & Confinement",
      why: "Isolation, confinement and irregular schedules affect mood, sleep and teamwork. Early signs: irritability, low energy, poor sleep.",
      metrics: [["Sleep last night", `${sim.sleepLastNight} h`], ["Mood today", today?.done ? `${today.mood}/5` : "Not logged"], ["Stress today", today?.done ? `${today.stress}/5` : "—"], ["HRV", `${Math.round(v.hrv)} ms`]],
      measure: ["Daily check-in (< 1 min)", "Wrist actigraphy for sleep", "Weekly psych conference with ground"],
      actions: ["Keep a consistent sleep window", "Schedule leisure + family call", "Talk to a crewmate when stressed"],
      evidence: ["sleepDur", "sleepEff", "mood"],
    },
  ];
}

export function earthReport(sim, systems, alerts, history) {
  const v = sim.vitals, e = sim.env;
  return [
    `ORBIT CARE — Health report · Mission day 182 · T+${sim.t} min`,
    `Mission: ${MISSIONS[sim.mission].label} · Link: ${MISSIONS[sim.mission].earthLink}`,
    ``,
    `ALERTS: ${alerts.length ? alerts.map((a) => `[${a.status.toUpperCase()}] ${a.title}`).join(" | ") : "none"}`,
    ``,
    `RADIATION: ${Math.round(e.radRate)} µSv/h · cumulative ${sim.doseMsv.toFixed(1)} / ${CAREER_LIMIT_MSV} mSv${sim.sheltered ? " · crew SHELTERED" : ""}`,
    `CABIN: CO2 ${e.co2.toFixed(2)}% · O2 ${e.o2.toFixed(1)}% · P ${e.pressure.toFixed(1)} kPa · T ${e.temp.toFixed(1)} °C`,
    `VITALS: HR ${Math.round(v.hr)} · HRV ${Math.round(v.hrv)} ms · SpO2 ${v.spo2.toFixed(0)}% · BP ${Math.round(v.sys)}/${Math.round(v.dia)} · Temp ${v.bodyTemp.toFixed(1)} °C`,
    `SYSTEMS: ${systems.map((s) => `${s.name}=${s.status}`).join(", ")}`,
    `LAST 7 DAYS: mood ${history.slice(-7).map((d) => d.mood).join(",")} · sleep ${history.slice(-7).map((d) => d.sleep).join(",")} h`,
  ].join("\n");
}
