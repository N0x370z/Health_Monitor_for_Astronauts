// Motor de simulación local. Velocidad demo: 1 segundo real = 1 minuto de misión.
import { useEffect, useReducer } from "react";
import { MISSIONS } from "../data/config.js";

const HIST_LEN = 120;
const TRACKED = ["radRate", "co2", "o2", "hr", "hrv", "spo2", "rr", "bodyTemp"];

function initial(mission = "iss") {
  const base = MISSIONS[mission].baseRad;
  const env = { radRate: base, co2: 0.42, o2: 20.9, pressure: 101.3, temp: 22.4, humidity: 46, noise: 54 };
  const vitals = { hr: 68, hrv: 42, spo2: 97.4, sys: 118, dia: 76, bodyTemp: 36.7, rr: 14, glucose: 92 };
  const hist = {};
  for (const k of TRACKED) {
    const v = env[k] ?? vitals[k];
    // ruido pseudoaleatorio determinista (valor base ± ~2%)
    hist[k] = Array.from({ length: 30 }, (_, i) => ({ t: i - 30, v: v * (1 + (((Math.sin(i * 12.9898 + k.length * 78.233) * 43758.5453) % 1) * 0.04 - 0.02)) }));
  }
  return {
    t: 0,
    mission,
    scenario: "nominal",
    scenarioStart: 0,
    sheltered: false,
    env,
    vitals,
    hist,
    doseMsv: 96.2,
    sleepLastNight: 6.8,
    eva: { active: false, start: 0, doseUSv: 0, o2Pct: 100, plannedMin: 390, suitPressure: 29.6, suitCo2: 1.6, metabolic: 210 },
  };
}

const approach = (cur, target, k, noise) => cur + (target - cur) * k + noise;

function tick(s, R) {
  const t = s.t + 1;
  const el = t - s.scenarioStart;
  const base = MISSIONS[s.mission].baseRad;
  const n = (i, amp) => (R[i] - 0.5) * 2 * amp;

  // --- Radiación ---
  let rad = base;
  // Tormenta solar: subida exponencial (se duplica cada 4 min) hasta el pico (min 27), luego decae (mitad cada 6 min)
  if (s.scenario === "storm" && el > 3) {
    const PEAK = 27;
    rad = el <= PEAK ? base * 2 ** ((el - 3) / 4) : Math.max(base, base * 2 ** ((PEAK - 3) / 4) * 0.5 ** ((el - PEAK) / 6));
  }
  if (s.eva.active) rad *= 1.6; // menos blindaje fuera
  if (s.sheltered) rad *= 0.15; // refugio blindado
  rad *= 1 + n(0, 0.04);

  // --- Ambiente ---
  const co2Target = s.scenario === "co2" ? Math.min(0.42 + 0.03 * el, 0.98) : 0.42;
  const env = {
    radRate: rad,
    co2: Math.max(0.2, approach(s.env.co2, co2Target, 0.25, n(1, 0.006))),
    o2: approach(s.env.o2, s.scenario === "co2" ? 20.5 : 20.9, 0.1, n(2, 0.02)),
    pressure: approach(s.env.pressure, 101.3, 0.2, n(3, 0.04)),
    temp: approach(s.env.temp, 22.4, 0.2, n(4, 0.05)),
    humidity: approach(s.env.humidity, 46, 0.2, n(5, 0.3)),
    noise: approach(s.env.noise, s.scenario === "co2" ? 59 : 54, 0.2, n(6, 0.4)),
  };

  // --- Vitales (objetivos según contexto) ---
  const co2x = Math.max(0, (env.co2 - 0.42) / 0.5);
  const fat = s.scenario === "fatigue";
  const storm = s.scenario === "storm" && el > 6 && !s.sheltered;
  const tgt = {
    hr: 68 + (s.eva.active ? 28 : 0) + co2x * 12 + (fat ? 7 : 0) + (storm ? 9 : 0),
    hrv: 42 - co2x * 9 - (fat ? 17 : 0) - (s.eva.active ? 10 : 0) - (storm ? 6 : 0),
    spo2: 97.4 - co2x * 1.4 - (fat ? 0.6 : 0),
    sys: 118 + (fat ? 9 : 0) + (s.eva.active ? 8 : 0) + co2x * 5,
    dia: 76 + (fat ? 6 : 0) + co2x * 3,
    bodyTemp: 36.7 + (fat ? 0.75 : 0) + (s.eva.active ? 0.2 : 0),
    rr: 14 + co2x * 7 + (s.eva.active ? 4 : 0),
    glucose: 92 + (s.eva.active ? -6 : 0),
  };
  const vitals = {
    hr: approach(s.vitals.hr, tgt.hr, 0.2, n(7, 1.4)),
    hrv: approach(s.vitals.hrv, tgt.hrv, 0.15, n(8, 1.2)),
    spo2: Math.min(100, approach(s.vitals.spo2, tgt.spo2, 0.2, n(9, 0.15))),
    sys: approach(s.vitals.sys, tgt.sys, 0.15, n(10, 1)),
    dia: approach(s.vitals.dia, tgt.dia, 0.15, n(11, 0.8)),
    bodyTemp: approach(s.vitals.bodyTemp, tgt.bodyTemp, 0.12, n(12, 0.03)),
    rr: approach(s.vitals.rr, tgt.rr, 0.2, n(13, 0.4)),
    glucose: approach(s.vitals.glucose, tgt.glucose, 0.1, n(14, 1)),
  };

  // --- Historial ---
  const hist = {};
  for (const k of TRACKED) {
    const v = env[k] ?? vitals[k];
    hist[k] = [...s.hist[k], { t, v }].slice(-HIST_LEN);
  }

  // --- Dosis acumulada (µSv/h * 1 min) ---
  const dUSv = rad / 60;
  let eva = s.eva;
  if (eva.active) {
    eva = {
      ...eva,
      doseUSv: eva.doseUSv + dUSv,
      o2Pct: Math.max(0, eva.o2Pct - 100 / (7.5 * 60)),
      suitPressure: approach(eva.suitPressure, 29.6, 0.3, n(15, 0.05)),
      suitCo2: approach(eva.suitCo2, 1.4 + (vitals.hr - 85) / 30, 0.2, n(16, 0.05)),
      metabolic: approach(eva.metabolic, 140 + (vitals.hr - 60) * 4.2, 0.2, n(17, 4)),
    };
  }

  return {
    ...s,
    t,
    env,
    vitals,
    hist,
    eva,
    doseMsv: s.doseMsv + dUSv / 1000,
    sleepLastNight: fat ? 4.6 : 6.8,
  };
}

function reducer(s, a) {
  switch (a.type) {
    case "tick": return tick(s, a.R);
    case "scenario": return { ...s, scenario: a.value, scenarioStart: s.t, sheltered: false };
    case "mission": return { ...s, mission: a.value };
    case "shelter": return { ...s, sheltered: a.value };
    case "evaStart": return { ...s, eva: { ...s.eva, active: true, start: s.t, doseUSv: 0, o2Pct: 100 } };
    case "evaEnd": return { ...s, eva: { ...s.eva, active: false } };
    default: return s;
  }
}

export function useSimulation() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initial());
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "tick", R: Array.from({ length: 18 }, Math.random) }), 1000);
    return () => clearInterval(id);
  }, []);
  return [state, dispatch];
}
