// Dominio: cómo leer la densidad ósea. Un cambio solo es real si supera el cambio mínimo
// significativo (LSC) del densitómetro en esa región (ISCD: LSC = 2.77 × precisión).

export const ROLE_LABEL = { key: "Key", supporting: "Supporting", control: "Control" };

export const CAMPAIGN_LABEL = {
  UTMB_C3: "UTMB Campaign 3",
  MEDES: "MEDES (women)",
  UTMB_C1: "UTMB Campaign 1",
  UTMB_AG_PILOT: "UTMB artificial gravity pilot",
};

const FIXED = { PRE: "Pre", BR_MID: "Mid bed rest", BR_END: "End of bed rest", FU_6MO: "+6 months", FU_1Y: "+1 year", FOLLOW_UP: "Follow-up" };
export const visitLabel = (v) => FIXED[v] ?? (v.startsWith("R+") ? v : v.startsWith("V") ? `Visit ${v.slice(1)}` : v);

/** Estado de un cambio de BMD frente al LSC: pérdida grande, pérdida real, estable o ganancia. */
export function boneStatus(pct, lsc) {
  if (pct == null || lsc == null) return "none";
  if (pct <= -2 * lsc) return "crit";
  if (pct <= -lsc) return "warn";
  if (pct >= lsc) return "watch";
  return "ok";
}
export const BONE_STATUS_LABEL = { crit: "Large loss (> 2× LSC)", warn: "Real loss (> LSC)", ok: "Within scanner error", watch: "Gain (> LSC)", none: "No data" };

export const signedPct = (x, d = 1) => (x == null ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(d)}%`);
export const fmtP = (p) => (p == null ? "" : p < 0.001 ? "p<0.001" : `p=${p.toFixed(3)}`);
