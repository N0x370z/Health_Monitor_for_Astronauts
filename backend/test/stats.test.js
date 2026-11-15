import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  agreement, benjaminiHochberg, hedgesG, kmeans, mean, median, oneSample, pearson, sd, spearman, tCritical, tPValue, welch,
} from '../src/services/stats.js';

const near = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

test('descriptivos ignoran valores faltantes', () => {
  near(mean([1, 2, null, 3]), 2);
  near(sd([2, 4, 4, 4, 5, 5, 7, 9]), 2.138, 1e-3);
  near(median([3, 1, 2, 4]), 2.5);
});

test('distribución t: valores de tablas', () => {
  near(tCritical(10), 2.228, 1e-3);
  near(tCritical(30), 2.042, 1e-3);
  near(tPValue(2.228, 10), 0.05, 1e-3);
  near(tPValue(0, 5), 1, 1e-9);
});

test('prueba t de una muestra y de Welch', () => {
  const one = oneSample([1, 2, 3, 4, 5], 0);
  near(one.t, 4.243, 1e-3);
  near(one.p, 0.0132, 1e-3);
  const w = welch([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
  near(w.diff, -3);
  near(w.df, 5.882, 1e-2);
  near(w.p, 0.1075, 1e-3); // verificado por integración numérica de la densidad t
});

test('g de Hedges con corrección por muestra pequeña', () => {
  near(hedgesG([1, 2, 3], [4, 5, 6]).g, -2.4, 1e-9);
});

test('correlación, regresión y Spearman', () => {
  const p = pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
  near(p.r, 1);
  near(p.slope, 2);
  near(p.intercept, 0);
  near(spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 100]).rho, 1);
});

test('Benjamini-Hochberg', () => {
  assert.deepEqual(benjaminiHochberg([0.01, 0.04, 0.03]).map((q) => Number(q.toFixed(3))), [0.03, 0.04, 0.04]);
});

test('acuerdo perfecto entre analistas: ICC 1 y MDC 0', () => {
  const a = agreement([[10, 10], [20, 20], [30, 30], [40, 40]]);
  near(a.icc, 1);
  near(a.mdc95_single, 0);
  near(a.bias, 0);
});

test('k-means separa dos grupos evidentes y es reproducible', () => {
  const pts = [[0, 0], [0.1, 0.2], [0.2, 0.1], [5, 5], [5.1, 4.9], [4.9, 5.2]];
  const a = kmeans(pts, 2);
  assert.equal(new Set(a.labels.slice(0, 3)).size, 1);
  assert.equal(new Set(a.labels.slice(3)).size, 1);
  assert.notEqual(a.labels[0], a.labels[3]);
  assert.ok(a.silhouette > 0.9);
  assert.deepEqual(kmeans(pts, 2).labels, a.labels);
});
