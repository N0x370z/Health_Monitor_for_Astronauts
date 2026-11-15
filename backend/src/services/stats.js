// Estadística descriptiva e inferencial sin dependencias.
// Todas las funciones ignoran valores null/undefined/NaN.

const clean = (xs) => xs.filter((x) => x != null && Number.isFinite(x));

export function mean(xs) {
  const v = clean(xs);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function sd(xs) {
  const v = clean(xs);
  if (v.length < 2) return null;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1));
}

export function median(xs) {
  const v = clean(xs).sort((a, b) => a - b);
  if (!v.length) return null;
  const h = Math.floor(v.length / 2);
  return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2;
}

export const round = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(d)));

/** Valor p legible: 3 decimales, o 2 cifras significativas si es menor que 0.001. */
export const roundP = (p) => (p == null || !Number.isFinite(p) ? null : p < 0.001 ? Number(p.toPrecision(2)) : round(p, 3));

/** Texto de un valor p para frases: "p=0.011" o "p<0.001". */
export const formatP = (p) => (p == null ? 'p no disponible' : p < 0.001 ? 'p<0.001' : `p=${p.toFixed(3)}`);

// ── Distribución t de Student ────────────────────────────────────────────
function logGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const k of c) ser += k / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a, b, x) {
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Función beta incompleta regularizada I_x(a, b). */
function incBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** p bilateral de un estadístico t con `df` grados de libertad. */
export function tPValue(t, df) {
  if (!Number.isFinite(t) || !(df > 0)) return null;
  return incBeta(df / (df + t * t), df / 2, 0.5);
}

/** Cuantil t de dos colas (p. ej. alpha 0.05 → t crítico para IC 95 %). */
export function tCritical(df, alpha = 0.05) {
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (tPValue(mid, df) > alpha) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── Pruebas ──────────────────────────────────────────────────────────────
/** Media con IC 95 % y prueba t de una muestra contra `mu` (cambio vs línea base = 0). */
export function oneSample(xs, mu = 0) {
  const v = clean(xs);
  const n = v.length;
  const m = mean(v);
  const s = sd(v);
  if (n < 2 || !s) return { n, mean: m, sd: s, ci95: null, t: null, p: null };
  const se = s / Math.sqrt(n);
  const tc = tCritical(n - 1);
  const t = (m - mu) / se;
  return { n, mean: m, sd: s, ci95: [m - tc * se, m + tc * se], t, p: tPValue(t, n - 1) };
}

/** Prueba t de Welch (varianzas distintas) para la diferencia de medias x − y. */
export function welch(xs, ys) {
  const x = clean(xs);
  const y = clean(ys);
  if (x.length < 2 || y.length < 2) return null;
  const vx = sd(x) ** 2 / x.length;
  const vy = sd(y) ** 2 / y.length;
  const diff = mean(x) - mean(y);
  const se = Math.sqrt(vx + vy);
  const df = (vx + vy) ** 2 / (vx ** 2 / (x.length - 1) + vy ** 2 / (y.length - 1));
  const t = diff / se;
  const tc = tCritical(df);
  return { diff, ci95: [diff - tc * se, diff + tc * se], t, df, p: tPValue(t, df) };
}

/** g de Hedges (d de Cohen con corrección por muestra pequeña) con IC 95 % aproximado. */
export function hedgesG(xs, ys) {
  const x = clean(xs);
  const y = clean(ys);
  const n1 = x.length;
  const n2 = y.length;
  if (n1 < 2 || n2 < 2) return null;
  const sp = Math.sqrt(((n1 - 1) * sd(x) ** 2 + (n2 - 1) * sd(y) ** 2) / (n1 + n2 - 2));
  if (!sp) return null;
  const j = 1 - 3 / (4 * (n1 + n2) - 9);
  const g = ((mean(x) - mean(y)) / sp) * j;
  const se = Math.sqrt((n1 + n2) / (n1 * n2) + (g * g) / (2 * (n1 + n2)));
  return { g, ci95: [g - 1.96 * se, g + 1.96 * se], magnitude: magnitude(g) };
}

function magnitude(g) {
  const a = Math.abs(g);
  return a < 0.2 ? 'trivial' : a < 0.5 ? 'pequeño' : a < 0.8 ? 'mediano' : 'grande';
}

// ── Correlación y regresión ──────────────────────────────────────────────
function pairs(xs, ys) {
  const out = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] != null && ys[i] != null && Number.isFinite(xs[i]) && Number.isFinite(ys[i])) out.push([xs[i], ys[i]]);
  }
  return out;
}

function pearsonPairs(p) {
  const n = p.length;
  if (n < 4) return null;
  const mx = mean(p.map((q) => q[0]));
  const my = mean(p.map((q) => q[1]));
  let sxy = 0; let sxx = 0; let syy = 0;
  for (const [x, y] of p) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (!sxx || !syy) return null;
  const r = sxy / Math.sqrt(sxx * syy);
  const t = (r * Math.sqrt(n - 2)) / Math.sqrt(Math.max(1e-12, 1 - r * r));
  const slope = sxy / sxx;
  return { r, n, p: tPValue(t, n - 2), slope, intercept: my - slope * mx, r2: r * r };
}

/** Correlación de Pearson con valor p y recta de regresión (y = intercept + slope·x). */
export function pearson(xs, ys) {
  return pearsonPairs(pairs(xs, ys));
}

function ranks(v) {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

/** Correlación de Spearman (rangos, robusta a valores extremos). */
export function spearman(xs, ys) {
  const p = pairs(xs, ys);
  if (p.length < 4) return null;
  const rx = ranks(p.map((q) => q[0]));
  const ry = ranks(p.map((q) => q[1]));
  const res = pearsonPairs(rx.map((x, i) => [x, ry[i]]));
  return res && { rho: res.r, n: res.n, p: res.p };
}

/** Pendiente por mínimos cuadrados de y contra x. */
export function slope(xs, ys) {
  const p = pairs(xs, ys);
  if (p.length < 2) return null;
  const mx = mean(p.map((q) => q[0]));
  const my = mean(p.map((q) => q[1]));
  let sxy = 0; let sxx = 0;
  for (const [x, y] of p) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  return sxx ? sxy / sxx : null;
}

/** Corrección de Benjamini-Hochberg: devuelve los valores q en el mismo orden. */
export function benjaminiHochberg(ps) {
  const idx = ps.map((p, i) => [p, i]).filter(([p]) => p != null).sort((a, b) => a[0] - b[0]);
  const q = new Array(ps.length).fill(null);
  let min = 1;
  for (let k = idx.length - 1; k >= 0; k--) {
    min = Math.min(min, (idx[k][0] * idx.length) / (k + 1));
    q[idx[k][1]] = min;
  }
  return q;
}

// ── Confiabilidad entre analistas ────────────────────────────────────────
/**
 * Acuerdo entre dos lectores sobre las mismas imágenes.
 * ICC(2,1) de acuerdo absoluto (Shrout y Fleiss 1979), SEM = √MSE y MDC95 (Weir 2005),
 * sesgo y límites de acuerdo de Bland-Altman (1986).
 */
export function agreement(pairsAB) {
  const n = pairsAB.length;
  const k = 2;
  if (n < 3) return null;
  const grand = mean(pairsAB.flat());
  const rowMeans = pairsAB.map(([a, b]) => (a + b) / 2);
  const colMeans = [mean(pairsAB.map((p) => p[0])), mean(pairsAB.map((p) => p[1]))];
  const ssr = k * rowMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const ssc = n * colMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const sst = pairsAB.flat().reduce((s, x) => s + (x - grand) ** 2, 0);
  const sse = sst - ssr - ssc;
  const msr = ssr / (n - 1);
  const msc = ssc / (k - 1);
  const mse = sse / ((n - 1) * (k - 1));
  const icc = (msr - mse) / (msr + (k - 1) * mse + (k * (msc - mse)) / n);
  const diffs = pairsAB.map(([a, b]) => a - b);
  const bias = mean(diffs);
  const sdd = sd(diffs);
  const sem = Math.sqrt(mse);
  return {
    n,
    grand_mean: grand,
    icc,
    sem,
    sem_pct: (sem / grand) * 100,
    // Cambio mínimo detectable entre dos sesiones leídas por un analista y por el promedio de los dos.
    mdc95_single: 1.96 * Math.SQRT2 * sem,
    mdc95_single_pct: ((1.96 * Math.SQRT2 * sem) / grand) * 100,
    mdc95_mean2: 1.96 * sem,
    mdc95_mean2_pct: ((1.96 * sem) / grand) * 100,
    bias,
    limits_of_agreement: [bias - 1.96 * sdd, bias + 1.96 * sdd],
  };
}

// ── Agrupamiento k-means (inicialización determinista) ───────────────────
/** Estandariza columnas (z-score). Devuelve la matriz y los parámetros usados. */
export function standardize(rows) {
  const cols = rows[0].length;
  const mu = [];
  const sigma = [];
  for (let j = 0; j < cols; j++) {
    const col = rows.map((r) => r[j]);
    mu.push(mean(col));
    sigma.push(sd(col) || 1);
  }
  return { z: rows.map((r) => r.map((x, j) => (x - mu[j]) / sigma[j])), mu, sigma };
}

const dist2 = (a, b) => a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0);

/** Generador pseudoaleatorio con semilla (mulberry32): resultados reproducibles. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * k-means++ (Arthur y Vassilvitskii 2007) con `restarts` reinicios y semilla fija;
 * se queda con la solución de menor inercia.
 */
export function kmeans(points, k, { restarts = 50, seed = 42 } = {}) {
  const rand = rng(seed);
  let best = null;
  for (let r = 0; r < restarts; r++) {
    const run = lloyd(points, k, seedCentroids(points, k, rand));
    if (!best || run.inertia < best.inertia) best = run;
  }
  return { ...best, silhouette: silhouette(points, best.labels, k) };
}

function seedCentroids(points, k, rand) {
  const centroids = [points[Math.floor(rand() * points.length)].slice()];
  while (centroids.length < k) {
    const d = points.map((p) => Math.min(...centroids.map((c) => dist2(p, c))));
    const total = d.reduce((a, b) => a + b, 0);
    let target = rand() * total;
    let i = 0;
    while (i < d.length - 1 && target > d[i]) target -= d[i++];
    centroids.push(points[i].slice());
  }
  return centroids;
}

function lloyd(points, k, centroids, maxIter = 100) {
  const dims = points[0].length;
  let labels = new Array(points.length).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    const next = points.map((p) => centroids.reduce((best, c, ci) => (dist2(p, c) < dist2(p, centroids[best]) ? ci : best), 0));
    const changed = next.some((l, i) => l !== labels[i]);
    labels = next;
    for (let c = 0; c < k; c++) {
      const members = points.filter((_, i) => labels[i] === c);
      if (members.length) centroids[c] = Array.from({ length: dims }, (_, j) => mean(members.map((m) => m[j])));
    }
    if (!changed && iter > 0) break;
  }
  const inertia = points.reduce((s, p, i) => s + dist2(p, centroids[labels[i]]), 0);
  return { labels, centroids, inertia };
}

/** Coeficiente de silueta medio: qué tan separados quedan los grupos (−1 a 1). */
function silhouette(points, labels, k) {
  if (k < 2) return null;
  const s = points.map((p, i) => {
    const byCluster = Array.from({ length: k }, () => []);
    points.forEach((q, j) => { if (j !== i) byCluster[labels[j]].push(Math.sqrt(dist2(p, q))); });
    const own = byCluster[labels[i]];
    if (!own.length) return 0;
    const a = mean(own);
    const b = Math.min(...byCluster.filter((_, c) => c !== labels[i] && byCluster[c].length).map(mean));
    return (b - a) / Math.max(a, b);
  });
  return mean(s);
}
