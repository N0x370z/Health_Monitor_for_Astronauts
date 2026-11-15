// Historial diario (14 días) + check-ins guardados localmente (offline).
const KEY = "orbitcare.checkins.v2";
export const TODAY = 70; // día del análogo (reposo en cama día 70)

// PRNG determinista para que la demo sea reproducible
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function seedHistory() {
  const r = rng(42);
  const days = [];
  let dose = 89.4;
  for (let d = TODAY - 13; d <= TODAY - 1; d++) {
    const stress = Math.round(2 + r() * 2);
    const sleep = +(6.2 + r() * 1.4 - (stress > 3 ? 0.6 : 0)).toFixed(1);
    const co2 = +(0.33 + r() * 0.14).toFixed(2);
    const mood = Math.max(1, Math.min(5, Math.round(4.4 - stress * 0.35 - (co2 > 0.43 ? 0.6 : 0) + (r() - 0.5))));
    const hrv = Math.round(36 + mood * 3 + sleep * 1.2 + (r() - 0.5) * 6);
    dose += 0.48 + r() * 0.06;
    days.push({
      day: d,
      mood,
      stress,
      energy: Math.max(1, Math.min(5, Math.round(mood + (r() - 0.5)))),
      social: Math.round(2 + r() * 3),
      sleep,
      sleepQuality: Math.max(1, Math.min(5, Math.round(sleep - 3))),
      symptoms: co2 > 0.44 && r() > 0.4 ? ["Headache"] : [],
      note: "",
      hrv,
      co2,
      dose: +dose.toFixed(1),
      exerciseMin: Math.round(95 + r() * 50),
      done: true,
    });
  }
  return days;
}

export function loadCheckins() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage bloqueado: usar seed */ }
  return seedHistory();
}

export function saveCheckins(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* sin storage */ }
}

export function resetCheckins() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
  return seedHistory();
}

export function streak(list) {
  let s = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].done) s++;
    else break;
  }
  return s;
}
