// Configuración de estados. La app usa solo los datos de la base CFT70 (ecocardiografía).

// Modo "solo base de datos": lo que no viene de los CSV de CFT70 se muestra como error (sin valores inventados).
export const DATA_ONLY = true;

export const RANK = { none: -1, ok: 0, watch: 1, warn: 2, crit: 3 };
export const worst = (...s) => s.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "ok");
export const STATUS_COLOR = { ok: "var(--ok)", watch: "var(--watch)", warn: "var(--warn)", crit: "var(--crit)", none: "var(--nodata)" };
export const STATUS_LABEL = { ok: "Nominal", watch: "Watch", warn: "Attention", crit: "Critical", none: "No data" };
