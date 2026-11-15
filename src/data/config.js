// Umbrales y configuración de misión.
// Valores de referencia: rangos clínicos estándar + órdenes de magnitud reportados en NLSP.

export const MISSIONS = {
  iss: { label: "ISS · Low Earth Orbit", baseRad: 21, commDelayMin: 0, earthLink: "Live link" },
  moon: { label: "Lunar Base", baseRad: 55, commDelayMin: 0.04, earthLink: "1.3 s delay" },
  mars: { label: "Mars Transit", baseRad: 75, commDelayMin: 12, earthLink: "12 min delay" },
};

export const CAREER_LIMIT_MSV = 600; // NASA career effective dose limit

// status: "ok" | "watch" | "warn" | "crit"
// Cada métrica: rangos [lo, hi] — fuera de warn => warn, fuera de crit => crit.
export const METRICS = {
  radRate: { label: "Dose rate", unit: "µSv/h", warn: [0, 120], crit: [0, 400], evidence: "radSkylab" },
  co2: { label: "CO₂", unit: "%", warn: [0, 0.5], crit: [0, 0.7], evidence: "co2" },
  o2: { label: "O₂", unit: "%", warn: [19.5, 23.1], crit: [18, 25], evidence: null },
  pressure: { label: "Pressure", unit: "kPa", warn: [97.9, 102.7], crit: [95, 104], evidence: null },
  temp: { label: "Temp", unit: "°C", warn: [18, 27], crit: [15, 30], evidence: null },
  humidity: { label: "Humidity", unit: "%", warn: [25, 70], crit: [15, 80], evidence: null },
  noise: { label: "Noise", unit: "dB", warn: [0, 60], crit: [0, 72], evidence: null },

  hr: { label: "Heart rate", unit: "bpm", warn: [50, 100], crit: [40, 130], evidence: "holter" },
  hrv: { label: "HRV", unit: "ms", warn: [30, 200], crit: [18, 250], evidence: "holter" },
  spo2: { label: "SpO₂", unit: "%", warn: [95, 100], crit: [92, 100], evidence: null },
  sys: { label: "Systolic", unit: "mmHg", warn: [90, 130], crit: [80, 145], evidence: "bp" },
  dia: { label: "Diastolic", unit: "mmHg", warn: [60, 85], crit: [50, 95], evidence: "bp" },
  bodyTemp: { label: "Body temp", unit: "°C", warn: [36, 37.5], crit: [35, 38.3], evidence: "immune" },
  rr: { label: "Resp. rate", unit: "/min", warn: [10, 20], crit: [8, 26], evidence: null },
  glucose: { label: "Glucose", unit: "mg/dL", warn: [70, 140], crit: [55, 200], evidence: null },
};

export function classify(key, v) {
  const m = METRICS[key];
  if (!m || v == null || Number.isNaN(v)) return "ok";
  if (v < m.crit[0] || v > m.crit[1]) return "crit";
  if (v < m.warn[0] || v > m.warn[1]) return "warn";
  return "ok";
}

export const RANK = { ok: 0, watch: 1, warn: 2, crit: 3 };
export const worst = (...s) => s.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "ok");
export const STATUS_COLOR = { ok: "var(--ok)", watch: "var(--watch)", warn: "var(--warn)", crit: "var(--crit)" };
export const STATUS_LABEL = { ok: "Nominal", watch: "Watch", warn: "Attention", crit: "Critical" };

export const SHELTER_TRANSIT_MIN = 3; // tiempo estimado para llegar al refugio blindado
export const AIRLOCK_TRANSIT_MIN = 15; // tiempo de regreso a la esclusa desde EVA
