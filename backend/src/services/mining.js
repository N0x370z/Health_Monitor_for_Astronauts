// Herramientas de validación y detección para el análisis de riesgo. Sin dependencias.
// Pensadas para muestras pequeñas (n ≈ 30-40): todo se evalúa FUERA de muestra
// (dejando un sujeto fuera) y con pruebas de permutación, no con supuestos de normalidad.

const ok = (x) => x != null && Number.isFinite(x);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sdev = (xs) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, xs.length - 1));
};
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/** Generador pseudoaleatorio con semilla (mulberry32): resultados reproducibles. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 1. Capacidad de discriminar: AUC ─────────────────────────────────────
/** AUC (Mann-Whitney). labels: 1 = evento (mala adaptación), 0 = no. Mayor score = más riesgo. */
export function rocAuc(scores, labels) {
  const pos = [];
  const neg = [];
  scores.forEach((s, i) => { if (ok(s) && labels[i] != null) (labels[i] ? pos : neg).push(s); });
  if (!pos.length || !neg.length) return null;
  let w = 0;
  for (const p of pos) for (const n of neg) w += p > n ? 1 : p === n ? 0.5 : 0;
  return w / (pos.length * neg.length);
}

/** p de permutación: ¿qué tan probable es un AUC así si el score no tuviera relación con el evento? */
export function permutationAuc(scores, labels, { B = 5000, seed = 7 } = {}) {
  const idx = scores.map((_, i) => i).filter((i) => ok(scores[i]) && labels[i] != null);
  const s = idx.map((i) => scores[i]);
  const l = idx.map((i) => labels[i]);
  const auc = rocAuc(s, l);
  if (auc == null) return null;
  const rand = rng(seed);
  const sh = l.slice();
  let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = sh.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [sh[i], sh[j]] = [sh[j], sh[i]];
    }
    if (rocAuc(s, sh) >= auc) ge++;
  }
  return { auc, p: (ge + 1) / (B + 1), n: s.length };
}

/** IC 95 % del AUC por bootstrap (percentiles). */
export function bootstrapAucCI(scores, labels, { B = 2000, seed = 11 } = {}) {
  const idx = scores.map((_, i) => i).filter((i) => ok(scores[i]) && labels[i] != null);
  const rand = rng(seed);
  const aucs = [];
  for (let b = 0; b < B; b++) {
    const pick = idx.map(() => idx[Math.floor(rand() * idx.length)]);
    const a = rocAuc(pick.map((i) => scores[i]), pick.map((i) => labels[i]));
    if (a != null) aucs.push(a);
  }
  if (aucs.length < B / 2) return null;
  aucs.sort((a, b) => a - b);
  return [aucs[Math.floor(0.025 * aucs.length)], aucs[Math.floor(0.975 * aucs.length)]];
}

// ── 2. Regresión logística con penalización (ridge) y validación LOO ─────
function solve(A, b) {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    if (Math.abs(d) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/** Pesos [intercepto, ...coeficientes] por Newton-Raphson con penalización L2 (no penaliza el intercepto). */
export function logisticRidge(X, y, { lambda = 1, iters = 100 } = {}) {
  const A = X.map((r) => [1, ...r]);
  const d = A[0].length;
  let w = new Array(d).fill(0);
  for (let it = 0; it < iters; it++) {
    const g = new Array(d).fill(0);
    const H = Array.from({ length: d }, () => new Array(d).fill(0));
    A.forEach((row, i) => {
      const p = sigmoid(row.reduce((s, v, j) => s + v * w[j], 0));
      const e = p - y[i];
      const v = p * (1 - p);
      for (let j = 0; j < d; j++) {
        g[j] += e * row[j];
        for (let k = 0; k < d; k++) H[j][k] += v * row[j] * row[k];
      }
    });
    for (let j = 1; j < d; j++) { g[j] += lambda * w[j]; H[j][j] += lambda; }
    H[0][0] += 1e-8;
    const step = solve(H, g);
    if (!step) break;
    w = w.map((x, j) => x - step[j]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  return w;
}

/** Probabilidad predicha para cada fila, entrenando SIN esa fila (cada fila = un sujeto). Estandariza dentro de cada pliegue. */
export function leaveOneOutLogistic(X, y, opts) {
  return X.map((row, i) => {
    const trX = X.filter((_, j) => j !== i);
    const trY = y.filter((_, j) => j !== i);
    const cols = row.length;
    const mu = Array.from({ length: cols }, (_, j) => mean(trX.map((r) => r[j])));
    const sg = Array.from({ length: cols }, (_, j) => sdev(trX.map((r) => r[j])) || 1);
    const w = logisticRidge(trX.map((r) => r.map((v, j) => (v - mu[j]) / sg[j])), trY, opts);
    return sigmoid(w[0] + row.reduce((s, v, j) => s + w[j + 1] * ((v - mu[j]) / sg[j]), 0));
  });
}

/** Brier y su referencia (predecir siempre la prevalencia). Brier skill > 0 = mejor que no saber nada. */
export function brier(probs, labels) {
  const n = labels.length;
  const b = probs.reduce((s, p, i) => s + (p - labels[i]) ** 2, 0) / n;
  const prev = mean(labels);
  const ref = labels.reduce((s, y) => s + (prev - y) ** 2, 0) / n;
  return { brier: b, reference: ref, skill: ref ? 1 - b / ref : null };
}

/** Sensibilidad y especificidad con un umbral de probabilidad. */
export function confusion(probs, labels, threshold = 0.5) {
  let tp = 0; let fp = 0; let tn = 0; let fn = 0;
  probs.forEach((p, i) => {
    const pred = p >= threshold;
    if (labels[i]) { pred ? tp++ : fn++; } else { pred ? fp++ : tn++; }
  });
  return { tp, fp, tn, fn, sensitivity: tp + fn ? tp / (tp + fn) : null, specificity: tn + fp ? tn / (tn + fp) : null };
}

// ── 3. Anomalías multivariadas: Mahalanobis con contracción ──────────────
/**
 * Distancia de Mahalanobis a un grupo de referencia. Con pocos sujetos la covarianza es inestable,
 * así que se contrae hacia la identidad (shrink 0-1). Devuelve una función dist(x).
 */
export function mahalanobisModel(ref, shrink = 0.2) {
  const d = ref[0].length;
  const mu = Array.from({ length: d }, (_, j) => mean(ref.map((r) => r[j])));
  const S = Array.from({ length: d }, (_, a) => Array.from({ length: d }, (_, b) => (
    ref.reduce((s, r) => s + (r[a] - mu[a]) * (r[b] - mu[b]), 0) / Math.max(1, ref.length - 1))));
  const tr = S.reduce((s, r, i) => s + r[i], 0) / d;
  const Sh = S.map((r, i) => r.map((v, j) => (1 - shrink) * v + (i === j ? shrink * tr : 0)));
  const inv = Array.from({ length: d }, (_, k) => solve(Sh, Array.from({ length: d }, (_, i) => (i === k ? 1 : 0))));
  return (x) => {
    const v = x.map((q, j) => q - mu[j]);
    let s = 0;
    for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) s += v[a] * inv[b][a] * v[b];
    return Math.sqrt(Math.max(0, s));
  };
}

// ── 4. Detección de tendencia sostenida: CUSUM ───────────────────────────
/**
 * CUSUM inferior (cambio sostenido a la baja). zs = cambio en unidades del error de medición
 * (p. ej. % de cambio / SEM %). k = holgura, h = límite de alarma (valores clásicos 0.5 y 4).
 * Devuelve la trayectoria acumulada y el índice del primer momento con alarma (o null).
 */
export function cusumLower(zs, { k = 0.5, h = 4 } = {}) {
  let s = 0;
  let alarm = null;
  const path = zs.map((z, i) => {
    if (!ok(z)) return null;
    s = Math.min(0, s + z + k);
    if (alarm == null && s <= -h) alarm = i;
    return s;
  });
  return { path, alarm };
}

// ── 5. Validación completa de una señal temprana ─────────────────────────
/**
 * rows: [{ id, exercise (0/1), x: cambio temprano (%), y: cambio final (%) }].
 * Evento = pérdida final de al menos `lossPct` (por defecto, el cambio mínimo detectable).
 * Score = pérdida temprana (−x). Devuelve AUC con IC y p de permutación, y la regresión logística
 * evaluada dejando un sujeto fuera, con y sin saber si hace ejercicio.
 */
export function evaluateEarlySignal(rows, lossPct) {
  const d = rows.filter((r) => ok(r.x) && ok(r.y));
  const labels = d.map((r) => (r.y <= -lossPct ? 1 : 0));
  const score = d.map((r) => -r.x);
  const perm = permutationAuc(score, labels);
  const out = {
    n: d.length,
    events: labels.reduce((a, b) => a + b, 0),
    event_definition: `pérdida ≥ ${lossPct.toFixed(1)} % al final`,
    auc_raw: perm?.auc ?? null,
    auc_ci95: bootstrapAucCI(score, labels),
    p_permutation: perm?.p ?? null,
  };
  if (out.events < 3 || out.events > d.length - 3) return { ...out, note: 'Muy pocos eventos o no-eventos para ajustar un modelo.' };
  const modelA = leaveOneOutLogistic(d.map((r) => [r.x]), labels, { lambda: 1 });
  const modelB = leaveOneOutLogistic(d.map((r) => [r.x, r.exercise]), labels, { lambda: 1 });
  out.loo_signal_only = { auc: rocAuc(modelA, labels), ...brier(modelA, labels), ...confusion(modelA, labels, 0.5) };
  out.loo_signal_plus_exercise = { auc: rocAuc(modelB, labels), ...brier(modelB, labels), ...confusion(modelB, labels, 0.5) };
  return out;
}