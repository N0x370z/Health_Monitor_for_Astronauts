// Dominio: alertas para el tripulante.
// La API (/api/subjects/:id) decide QUÉ alertas hay (reglas de la base, filtro por error de medición y
// tendencia CUSUM). Aquí solo se arma el texto en inglés a partir de los campos estructurados
// (rule_id, métrica, % de cambio), porque la base guarda los textos en español.
// Si la API no responde, se usa el estado calculado en el navegador (findings) como respaldo.
import { CHAMBERS, HM } from "./heart.js";

// Reglas de alert_rule (data/health_monitor.sqlite): condición y acción en inglés.
export const RULE_EN = {
  AR01: ["Heart rate above 90 bpm (or below 45) at rest", "Rest, drink water and repeat the measurement in 5–10 min. Check temperature and SpO₂."],
  AR02: ["Heart rate at or above 131 bpm, or at or below 40 bpm", "Stop all activity, record an ECG and call the flight surgeon now."],
  AR03: ["Resting heart rate more than 10 % above your baseline", "Check your fluid intake and that you follow your exercise plan."],
  AR04: ["Resting heart rate more than 20 % above your baseline", "See the flight surgeon and repeat the echo. Your exercise and fluid plan may need to change."],
  AR05: ["Heart muscle (LV mass) more than 5 % below your baseline", "Do more aerobic and resistance exercise. Repeat the echo in 14 days."],
  AR06: ["Heart muscle (LV mass) more than 10 % below your baseline", "Review it with the flight surgeon today. Intensify exercise and repeat the echo every week."],
  AR07: ["Blood pumped per beat more than 7 % below your baseline", "Reinforce aerobic exercise and check your fluid balance."],
  AR08: ["Blood pumped per beat more than 12 % below your baseline", "Start a fluid-loading plan and get a medical check before any change in gravity."],
  AR09: ["Blood flow per beat (LVOT VTI) more than 10 % below your baseline", "Watch your resting heart rate and fluids. Repeat the echo."],
  AR10: ["Blood flow per beat (LVOT VTI) more than 20 % below your baseline", "Start fluid loading and get a medical check."],
  AR11: ["Heart filling (E/A) more than 20 % below your baseline", "An early sign of volume loss: check your fluids and exercise."],
  AR12: ["Filling pressure (lateral E/e′) above 13", "Ask the flight surgeon to review your heart filling."],
  AR13: ["Heart rate rises 30 bpm or more when you stand up", "Use the compression garment and fluid loading. Stand up with help."],
  AR14: ["Heart rate rises 40 bpm or more when you stand up", "Do not stand without help. Ask the flight surgeon about midodrine."],
  AR15: ["Systolic pressure drops 20 mmHg or more when you stand up", "Use the compression garment and fluid loading."],
  AR16: ["Systolic pressure drops 30 mmHg or more when you stand up", "Lie down and call the flight surgeon."],
  AR17: ["Daily average systolic pressure at or above 130 mmHg", "Repeat the measurements and review the trend with the flight surgeon."],
  AR18: ["Systolic pressure at or above 220, or at or below 90 mmHg", "Call the flight surgeon now."],
  AR25: ["30-day radiation dose at 80 % or more of the heart limit", "Reduce exposure: use the shelter and limit spacewalks."],
  AR28: ["Heart filling volume (LVEDV) more than 7 % below your baseline", "Check your fluid balance and reinforce aerobic exercise."],
  AR29: ["Heart filling volume (LVEDV) more than 12 % below your baseline", "Start fluid loading, get a medical check and repeat the echo in 7 days."],
  AR30: ["Heart filling (E/A) more than 30 % below your baseline", "Marked loss of filling: fluid loading, exercise and a medical check."],
  AR31: ["Average filling pressure (E/e′) above 14", "Filling pressure may be high. Repeat the echo and review it with the flight surgeon."],
  AR32: ["Heart performance (Tei index) more than 20 % worse than your baseline", "Check that you follow your exercise plan and repeat the echo."],
  AR33: ["Heart performance (Tei index) more than 35 % worse than your baseline", "Review it with the flight surgeon before any spacewalk or the return."],
};

// Contramedidas de la tabla countermeasure.
export const COUNTERMEASURE_EN = {
  EXERCISE_ISS: "Aerobic + resistance exercise",
  EXERCISE_FLYWHEEL: "Flywheel exercise (compact device)",
  FLUID_LOADING: "Fluid and salt loading before the return",
  COMPRESSION_GARMENT: "Compression garment",
  MIDODRINE: "Midodrine (under medical supervision)",
  RADIATION_SHELTER: "Radiation shelter",
  MEDICAL_CONSULT: "Flight surgeon consult",
  REST_REASSESS: "Rest and measure again",
};

const GROUP_EN = { EXERCISE_A: "Exercise A", EXERCISE_B: "Exercise B", FLYWHEEL: "Flywheel" };
const LEVEL = { critical: "crit", warning: "warn" };
const signed = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)} %`;
const round = (x) => (Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(2).replace(/\.?0+$/, ""));

/** Alertas de la API → lista para la interfaz: { id, level, kind, title, why, action, countermeasure }. */
export function alertsFromApi(body) {
  if (!body?.recommendations) return null;
  const out = [];
  for (const r of body.recommendations) {
    if (r.kind === "alert") {
      const [why, action] = RULE_EN[r.rule_id] ?? [
        `${r.value != null ? `${round(r.value)} ${r.unit ?? ""}`.trim() : "Value"} is outside the normal range`,
        "Repeat the measurement and review it with the flight surgeon if it persists.",
      ];
      out.push({
        id: `${r.kind}-${r.metric_code}`, kind: "alert", level: LEVEL[r.level] ?? "warn",
        title: `${r.metric_name_en} ${r.pct_change ? signed(r.pct_change) : r.value != null ? `${round(r.value)} ${r.unit ?? ""}` : ""}`.trim(),
        why, action, countermeasure: COUNTERMEASURE_EN[r.countermeasure_code] ?? null,
      });
    } else if (r.kind === "trend") {
      out.push({
        id: `trend-${r.metric_code}`, kind: "trend", level: "warn",
        title: `Steady decline in ${r.metric_name_en} (since ${r.since_timepoint})`,
        why: `The total change is larger than the measurement error (σ = ${r.sigma_pct} %), so it is a real trend, not noise.`,
        action: "Confirm it with a second measurement and make sure you follow your countermeasure.",
        countermeasure: COUNTERMEASURE_EN[r.countermeasure_code] ?? null,
      });
    }
  }
  const rec = body.countermeasure?.recommended;
  if (!body.countermeasure?.current && rec && out.length) {
    out.push({
      id: "countermeasure", kind: "countermeasure", level: "info",
      title: `Start ${GROUP_EN[rec.group_code] ?? rec.group_code}`,
      why: `You have no exercise program assigned. In the study, ${GROUP_EN[rec.group_code] ?? rec.group_code} kept LV mass at ${signed(rec.lv_mass_pct_d70)} by day 70.`,
      action: "Ask the flight surgeon to assign this aerobic + resistance program.",
      countermeasure: COUNTERMEASURE_EN[rec.countermeasure_code] ?? null,
    });
  }
  return out;
}

/** Respaldo sin API: hallazgos calculados en el navegador (domain/heart.js). */
export function alertsFromFindings(findings) {
  return findings
    .filter((f) => f.status === "crit" || f.status === "warn")
    .map((f) => {
      const chamber = Object.values(CHAMBERS).find((c) => c.keys.includes(f.k));
      return {
        id: `local-${f.k}`, kind: "alert", level: f.status,
        title: `${HM[f.k].label}${f.d != null ? ` ${signed(f.d)}` : ""}`,
        why: f.text,
        action: f.status === "crit"
          ? "Tell the flight surgeon today and repeat the echo."
          : chamber?.actions?.[0] ?? "Keep your exercise program and repeat the measurement.",
        countermeasure: null,
      };
    });
}

/** Resumen para el banner y el contador de la pestaña. */
export function alertSummary(list) {
  const crit = list.filter((a) => a.level === "crit").length;
  const warn = list.filter((a) => a.level === "warn").length;
  return { crit, warn, level: crit ? "crit" : warn ? "warn" : "ok" };
}
