// Signos vitales en vivo (SIMULADOS). Solo pulso y oxigenación.
// El pulso parte del valor real de la base CFT70 (HR por TDI) del sujeto en el momento elegido
// y varía cada segundo (arritmia sinusal respiratoria + ruido con reversión a la media).
// La SpO₂ no existe en la base: se simula alrededor de un valor fisiológico de referencia (98 %).
// Nada de esto modifica la base de datos.
import { useEffect, useState } from "react";
import { TIMEPOINTS } from "../data/echo.js";

export const SPO2_REF = 98;
const HISTORY = 60; // segundos guardados para las mini gráficas

/** Pulso de partida: el del momento elegido; si falta, el punto medido más cercano del mismo sujeto. */
export function baseHeartRate(subject, tpKey) {
  const own = subject.tp[tpKey]?.hr;
  if (own != null) return { hr: own, from: tpKey, exact: true };
  const i = TIMEPOINTS.findIndex((t) => t.key === tpKey);
  const near = TIMEPOINTS.map((t, j) => ({ t, dist: Math.abs(j - i) }))
    .filter(({ t }) => subject.tp[t.key]?.hr != null)
    .sort((a, b) => a.dist - b.dist)[0];
  return near ? { hr: subject.tp[near.t.key].hr, from: near.t.key, exact: false } : { hr: null, from: null, exact: false };
}

const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function init(key, base) {
  return { key, base, t: 0, hrNoise: 0, spNoise: 0, hr: base, spo2: SPO2_REF, hrHist: base == null ? [] : [base], spHist: [SPO2_REF] };
}

function step(s) {
  const t = s.t + 1;
  // SpO₂: reversión a 98 %, con alguna caída breve ocasional
  const dip = Math.random() < 0.04 ? -1.5 - Math.random() * 1.5 : 0;
  const spNoise = s.spNoise * 0.7 + gauss() * 0.35 + dip;
  const spo2 = clamp(SPO2_REF + spNoise, 93, 100);
  let hr = null, hrNoise = 0;
  if (s.base != null) {
    hrNoise = s.hrNoise * 0.85 + gauss() * 0.9; // Ornstein-Uhlenbeck discreto
    const rsa = 2 * Math.sin((2 * Math.PI * t) / 5); // respiración ~12/min
    hr = clamp(s.base + rsa + hrNoise, s.base - 12, s.base + 14);
  }
  return {
    ...s, t, hr, spo2, hrNoise, spNoise,
    hrHist: hr == null ? [] : [...s.hrHist, hr].slice(-HISTORY),
    spHist: [...s.spHist, spo2].slice(-HISTORY),
  };
}

/** Pulso y SpO₂ simulados, actualizados cada segundo. Se reinician al cambiar de sujeto o de momento. */
export function useLiveVitals(subject, tpKey) {
  const base = baseHeartRate(subject, tpKey);
  const key = `${subject.id}|${tpKey}`;
  const [s, setS] = useState(() => init(key, base.hr));
  if (s.key !== key) setS(init(key, base.hr));

  useEffect(() => {
    const id = setInterval(() => setS(step), 1000);
    return () => clearInterval(id);
  }, []);

  return { ...s, baseFrom: base.from, exact: base.exact };
}
