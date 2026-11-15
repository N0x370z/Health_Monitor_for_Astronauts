// Motor cardíaco: estado por métrica, cámaras del corazón, hallazgos y comparación de contramedidas.
import { ECHO, TIMEPOINTS, TREATMENTS } from "../data/echo.js";
import { worst, RANK, DATA_ONLY } from "../data/config.js";

// lo/hi: rango absoluto (warn, crit). dWarn/dCrit: % de cambio vs la línea base personal (Pre).
export const HM = {
  lvMass: { label: "LV mass", unit: "g", dec: 0, dWarn: -8, dCrit: -15, src: "echo3d" },
  edv: { label: "LV end-diastolic volume", short: "LVEDV", unit: "mL", dec: 0, dWarn: -10, dCrit: -20, src: "echo3d" },
  esv: { label: "LV end-systolic volume", short: "LVESV", unit: "mL", dec: 0, src: "echo3d" },
  sv: { label: "Stroke volume (3D)", short: "SV", unit: "mL", dec: 0, dWarn: -15, dCrit: -25, src: "echo3d" },
  ef: { label: "Ejection fraction", short: "EF", unit: "%", dec: 0, warnLo: 52, critLo: 40, src: "echo3d" },
  co: { label: "Cardiac output", short: "CO", unit: "L/min", dec: 1, warnLo: 3.5, critLo: 2.5, src: "echo3d" },
  hr: { label: "Heart rate", short: "HR", unit: "bpm", dec: 0, warnHi: 90, critHi: 110, dWarnUp: 20, dCritUp: 35, src: "echoAll" },
  fs: { label: "Fractional shortening", short: "FS", unit: "%", dec: 0, warnLo: 28, critLo: 20, src: "echoAll" },
  lvidd: { label: "LV diameter (diastole)", short: "LVIDd", unit: "cm", dec: 2, dWarn: -8, dCrit: -15, src: "echoAll" },
  vti: { label: "LVOT velocity-time integral", short: "LVOT VTI", unit: "cm", dec: 1, warnLo: 16, critLo: 12, dWarn: -20, dCrit: -30, src: "echoAll" },
  ea: { label: "Mitral E/A ratio", short: "E/A", unit: "", dec: 2, warnLo: 0.8, critLo: 0.6, warnHi: 2.5, src: "echoAll" },
  ee: { label: "E/e′ (filling pressure)", short: "E/e′", unit: "", dec: 1, warnHi: 10, critHi: 14, src: "echoAll" },
  mDt: { label: "Mitral deceleration time", short: "DT", unit: "ms", dec: 0, warnHi: 280, src: "echoAll" },
  tei: { label: "LV Tei index (MPI)", short: "Tei", unit: "", dec: 2, warnHi: 0.45, critHi: 0.6, src: "echoAll" },
  rvS: { label: "RV systolic velocity (TDI S′)", short: "RV S′", unit: "cm/s", dec: 1, warnLo: 9.5, critLo: 8, src: "echoAll" },
  rvsp: { label: "Estimated RV systolic pressure", short: "RVSP", unit: "mmHg", dec: 0, warnHi: 35, critHi: 45, src: "echoAll" },
  latS: { label: "Mitral annular S′", short: "LV S′", unit: "cm/s", dec: 1, warnLo: 7, critLo: 5.5, src: "echoAll" },
};

export const fmt = (k, v) => (v == null ? "—" : v.toFixed(HM[k]?.dec ?? 1));

export function readingText(r) {
  const d = HM[r.k];
  if (r.v == null) return "No data";
  return `${fmt(r.k, r.v)}${d.unit ? " " + d.unit : ""}${r.d != null ? `  (${r.d >= 0 ? "+" : ""}${r.d.toFixed(0)}% vs pre)` : ""}${r.carried ? " · last value" : ""}`;
}

export function delta(v, base) {
  return v == null || base == null ? null : ((v - base) / base) * 100;
}

export function metricStatus(k, v, base) {
  const d = HM[k];
  if (!d || v == null) return "none";
  let s = "ok";
  if (d.critLo != null && v < d.critLo) s = worst(s, "crit");
  else if (d.warnLo != null && v < d.warnLo) s = worst(s, "warn");
  if (d.critHi != null && v > d.critHi) s = worst(s, "crit");
  else if (d.warnHi != null && v > d.warnHi) s = worst(s, "warn");
  const dd = delta(v, base);
  if (dd != null) {
    if (d.dCrit != null && dd <= d.dCrit) s = worst(s, "crit");
    else if (d.dWarn != null && dd <= d.dWarn) s = worst(s, "warn");
    else if (d.dWarn != null && dd <= d.dWarn / 2) s = worst(s, "watch");
    if (d.dCritUp != null && dd >= d.dCritUp) s = worst(s, "crit");
    else if (d.dWarnUp != null && dd >= d.dWarnUp) s = worst(s, "warn");
  }
  return s;
}

/** Valor de una métrica en un punto; si falta, usa el punto disponible más cercano anterior (marcado). */
export function valueAt(subject, tpKey, k) {
  const m = subject.tp[tpKey];
  if (m && m[k] != null) return { v: m[k], from: tpKey };
  if (DATA_ONLY) return { v: null, from: null }; // no arrastrar valores: si la base no lo midió, es "sin dato"
  const idx = TIMEPOINTS.findIndex((t) => t.key === tpKey);
  for (let i = idx - 1; i >= 0; i--) {
    const p = subject.tp[TIMEPOINTS[i].key];
    if (p && p[k] != null) return { v: p[k], from: TIMEPOINTS[i].key };
  }
  return { v: null, from: null };
}

export function reading(subject, tpKey, k) {
  const { v, from } = valueAt(subject, tpKey, k);
  const base = subject.tp.pre?.[k] ?? null;
  return { k, v, base, d: tpKey === "pre" ? null : delta(v, base), status: metricStatus(k, v, tpKey === "pre" ? null : base), carried: from && from !== tpKey ? from : null };
}

const SCORE = { ok: 95, watch: 78, warn: 52, crit: 22, none: 80 };

export const CHAMBERS = {
  lv: {
    name: "Left ventricle", sub: "Pump & muscle mass", keys: ["lvMass", "edv", "ef", "fs", "lvidd", "latS"],
    risk: "Cardiovascular Adaptations · cardiac atrophy", hazard: "Gravity Fields",
    why: "In microgravity (and head-down bed rest) the heart pumps against less load and blood volume falls. The left ventricle can lose muscle mass and shrink, reducing the reserve needed on return to gravity.",
    measure: ["3D echocardiography for LV mass and volumes (weekly)", "M-mode LV diameters", "Tissue Doppler mitral annular S′"],
    actions: ["Keep the prescribed resistance + aerobic program (Exercise / Flywheel)", "Hydrate 2–2.5 L/day to support plasma volume", "Report breathlessness or reduced exercise tolerance"],
  },
  mitral: {
    name: "Mitral valve", sub: "LV filling (diastole)", keys: ["ea", "ee", "mDt"],
    risk: "Cardiovascular Adaptations · diastolic function", hazard: "Gravity Fields",
    why: "Mitral inflow (E/A) and E/e′ show how easily the ventricle fills. Lower preload in microgravity changes filling patterns; a high E/e′ suggests raised filling pressure.",
    measure: ["Pulsed Doppler mitral inflow (E, A, deceleration time)", "Tissue Doppler e′ (septal + lateral)"],
    actions: ["Re-measure after 10 min rest, same posture", "Hydration check", "Flag E/e′ > 14 to the flight surgeon"],
  },
  aortic: {
    name: "Aortic outflow", sub: "Stroke volume & output", keys: ["vti", "sv", "co", "hr"],
    risk: "Orthostatic intolerance on return to gravity", hazard: "Gravity Fields",
    why: "LVOT VTI and stroke volume tell how much blood each beat ejects. A drop with a faster heart rate is the classic deconditioning pattern that causes dizziness on standing after landing.",
    measure: ["LVOT VTI by pulsed Doppler", "3D stroke volume", "Heart rate from TDI"],
    actions: ["Fluid loading + salt tablets before re-entry", "Compression garment for landing", "Countermeasure exercise to preserve stroke volume"],
  },
  rv: {
    name: "Right ventricle", sub: "Pulmonary side", keys: ["rvS", "rvsp"],
    risk: "Cardiovascular Adaptations · RV function", hazard: "Gravity Fields",
    why: "The right ventricle pumps to the lungs. Tricuspid annular S′ shows its contraction; tricuspid regurgitation velocity estimates pulmonary pressure.",
    measure: ["Tissue Doppler tricuspid annulus S′", "Tricuspid regurgitation jet velocity"],
    actions: ["Report swelling of legs or breathlessness", "Keep aerobic exercise", "Re-check if RV S′ < 9.5 cm/s"],
  },
  rhythm: {
    name: "Rate & timing", sub: "Conduction & efficiency", keys: ["hr", "tei"],
    risk: "Cardiac rhythm & efficiency", hazard: "Isolation & stress",
    why: "Heart rate rises when stroke volume falls. The Tei index combines contraction and relaxation times — higher values mean a less efficient heart cycle.",
    measure: ["Heart rate (TDI / wearable)", "Isovolumic contraction & relaxation times, ejection time"],
    actions: ["Rest 5 min and re-measure", "Breathing exercise if stressed", "ECG if irregular rhythm is suspected"],
  },
};

export function chamberState(subject, tpKey, key) {
  const c = CHAMBERS[key];
  const readings = c.keys.map((k) => reading(subject, tpKey, k));
  const valid = readings.filter((r) => r.status !== "none");
  if (!valid.length) return { key, ...c, status: "none", score: null, readings };
  const st = valid.reduce((a, r) => (RANK[r.status] > RANK[a] ? r.status : a), "ok");
  const score = Math.round(valid.reduce((a, r) => a + SCORE[r.status], 0) / valid.length);
  return { key, ...c, status: st, score, readings };
}

export function heartState(subject, tpKey) {
  const chambers = Object.keys(CHAMBERS).map((k) => chamberState(subject, tpKey, k));
  const withData = chambers.filter((c) => c.score != null);
  const score = withData.length ? Math.round(withData.reduce((a, c) => a + c.score, 0) / withData.length) : null;
  const status = withData.length ? withData.reduce((a, c) => (RANK[c.status] > RANK[a] ? c.status : a), "ok") : "none";
  return { chambers, score, status, measured: withData.length };
}

const TEXT = {
  lvMass: (r) => `LV mass ${r.d.toFixed(0)}% vs baseline — cardiac atrophy`,
  edv: (r) => `LV volume ${r.d.toFixed(0)}% — less blood filling the heart`,
  sv: (r) => `Stroke volume ${r.d.toFixed(0)}% per beat`,
  ef: (r) => `Ejection fraction ${r.v.toFixed(0)}%`,
  co: (r) => `Cardiac output ${r.v.toFixed(1)} L/min`,
  hr: (r) => `Heart rate ${r.v.toFixed(0)} bpm (${r.d >= 0 ? "+" : ""}${r.d?.toFixed(0) ?? 0}%)`,
  vti: (r) => `LVOT VTI ${r.v.toFixed(1)} cm — low forward flow`,
  ee: (r) => `E/e′ ${r.v.toFixed(1)} — raised filling pressure`,
  ea: (r) => `Mitral E/A ${r.v.toFixed(2)} — altered filling`,
  tei: (r) => `Tei index ${r.v.toFixed(2)} — less efficient cycle`,
  rvS: (r) => `RV S′ ${r.v.toFixed(1)} cm/s — reduced RV contraction`,
  rvsp: (r) => `RVSP ≈ ${r.v.toFixed(0)} mmHg`,
  fs: (r) => `Fractional shortening ${r.v.toFixed(0)}%`,
  lvidd: (r) => `LV diameter ${r.d.toFixed(0)}% vs baseline`,
  latS: (r) => `LV S′ ${r.v.toFixed(1)} cm/s`,
  mDt: (r) => `Mitral DT ${r.v.toFixed(0)} ms — slow relaxation`,
};

export function findings(subject, tpKey) {
  const keys = ["lvMass", "edv", "sv", "ef", "co", "hr", "vti", "ee", "ea", "tei", "rvS", "rvsp", "fs", "lvidd", "mDt"];
  return keys
    .map((k) => reading(subject, tpKey, k))
    .filter((r) => r.status !== "ok" && r.status !== "none" && !r.carried)
    .map((r) => ({ ...r, text: TEXT[r.k](r) }))
    .sort((a, b) => RANK[b.status] - RANK[a.status]);
}

/** Cambio medio (%) por grupo de tratamiento entre Pre y un punto del estudio. */
export function groupChange(k, tpKey = "d70") {
  const out = {};
  for (const t of TREATMENTS) {
    const ds = Object.values(ECHO.subjects)
      .filter((s) => s.treatment === t)
      .map((s) => delta(s.tp[tpKey]?.[k], s.tp.pre?.[k]))
      .filter((d) => d != null);
    out[t] = { n: ds.length, mean: ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null };
  }
  return out;
}

export function bestCountermeasure(k = "lvMass", tpKey = "d70") {
  const g = groupChange(k, tpKey);
  const ex = TREATMENTS.filter((t) => t !== "Control" && g[t].mean != null).sort((a, b) => g[b].mean - g[a].mean);
  return { best: ex[0], g };
}

export function heartReport(subject, tpKey, hs, f) {
  const tp = TIMEPOINTS.find((t) => t.key === tpKey);
  const r = (k) => reading(subject, tpKey, k);
  const line = (k) => { const x = r(k); return `${HM[k].short ?? HM[k].label} ${x.v == null ? "ERROR" : fmt(k, x.v)}${HM[k].unit ? " " + HM[k].unit : ""}${x.d != null ? ` (${x.d >= 0 ? "+" : ""}${x.d.toFixed(0)}%)` : ""}`; };
  return [
    `ORBIT CARE — Cardiac report · Subject ${subject.id} (${subject.treatment})`,
    `Timepoint: ${tp.long} · Heart score ${hs.score == null ? "ERROR (no echo data at this timepoint)" : `${hs.score}/100 (${hs.status.toUpperCase()})`}`,
    ``,
    `LV: ${["lvMass", "edv", "ef", "fs"].map(line).join(" · ")}`,
    `Output: ${["sv", "co", "vti", "hr"].map(line).join(" · ")}`,
    `Filling: ${["ea", "ee"].map(line).join(" · ")} · RV: ${["rvS", "rvsp"].map(line).join(" · ")}`,
    ``,
    `FINDINGS: ${f.length ? f.map((x) => `[${x.status.toUpperCase()}] ${x.text}`).join(" | ") : "none"}`,
    `Source: BRSMCF CFT70 echo datasets (2D/Doppler/TDI + 3D).`,
  ].join("\n");
}
