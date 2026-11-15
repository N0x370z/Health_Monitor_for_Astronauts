// Análisis local (sin APIs): regresión, detección de crecimiento exponencial, correlaciones.

export function linreg(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const slope = sxx ? sxy / sxx : 0;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { slope, intercept: my - slope * mx, r2 };
}

/**
 * Detecta crecimiento exponencial ajustando log(valor) vs tiempo.
 * samples: [{ t (min), v }]. Devuelve tiempo de duplicación en minutos.
 */
export function detectExponential(samples, { window = 6, minR2 = 0.9, maxDoublingMin = 30, minRise = 1.5 } = {}) {
  const s = samples.slice(-window).filter((p) => p.v > 0);
  if (s.length < window) return { exponential: false };
  const { slope, r2 } = linreg(s.map((p) => p.t), s.map((p) => Math.log(p.v)));
  const rise = s[s.length - 1].v / s[0].v;
  if (slope <= 0) return { exponential: false, slope, r2 };
  const doublingMin = Math.LN2 / slope;
  const exponential = r2 >= minR2 && doublingMin <= maxDoublingMin && rise >= minRise;
  return { exponential, slope, r2, doublingMin, rise };
}

/** Minutos hasta que una serie exponencial (pendiente log) alcanza target. */
export function minutesUntil(current, target, slope) {
  if (current >= target) return 0;
  if (!slope || slope <= 0) return Infinity;
  return Math.log(target / current) / slope;
}

/** Tasa de cambio lineal por minuto (últimos n puntos). */
export function ratePerMin(samples, n = 6) {
  const s = samples.slice(-n);
  if (s.length < 3) return 0;
  return linreg(s.map((p) => p.t), s.map((p) => p.v)).slope;
}

export function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const { r2, slope } = linreg(a.slice(0, n), b.slice(0, n));
  return Math.sign(slope) * Math.sqrt(r2);
}

export const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
export const sd = (arr) => {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
};
/** z-score frente a la línea base personal */
export const zscore = (v, base) => (sd(base) ? (v - mean(base)) / sd(base) : 0);

export const fmtMin = (m) => {
  if (!Number.isFinite(m)) return "—";
  if (m < 1) return "<1 min";
  if (m < 60) return `${Math.round(m)} min`;
  return `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;
};
