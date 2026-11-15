// Fuente principal de datos: estudio BRSMCF CFT70 (70 días de reposo en cama con inclinación cabeza abajo,
// análogo de microgravedad). Ecocardiografía 2D/Doppler/TDI + ecocardiografía 3D.
// Los CSV se empaquetan con la app (funciona offline).
import allCsv from "./echo/echo_all.csv?raw";
import crewCsv from "./echo/echo_7_subjects.csv?raw";
import d3Csv from "./echo/echo_3d.csv?raw";

export const SOURCES = {
  echoAll: { id: "BRSMCF CFT70 Echo All Data", detail: "37 subjects · 2D/Doppler/TDI echo · 5 timepoints" },
  echo3d: { id: "BRSMCF CFT70 3D Echo Data", detail: "3D echo · LV mass, LVEDV, LVESV · 2 analyzers" },
  echoCrew: { id: "BRSMCF CFT70 Echo 7 Subjects", detail: "7-subject crew subset" },
};

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const num = (v) => {
  if (v == null || v === "" || /^n\/?a$/i.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null; // 0.00 = medida faltante en el archivo de 7 sujetos
};

// Línea de tiempo del estudio
export const TIMEPOINTS = [
  { key: "pre", label: "Pre", long: "Pre bed rest (BR−2)", phase: "PRE_TEST" },
  { key: "d7", label: "D7", long: "Bed rest day 7", phase: "IN_TEST" },
  { key: "d21", label: "D21", long: "Bed rest day 21", phase: "IN_TEST" },
  { key: "d30", label: "D30", long: "Bed rest day 30", phase: "IN_TEST" },
  { key: "d70", label: "D70", long: "Bed rest day 70", phase: "IN_TEST" },
  { key: "r0", label: "R+0", long: "Recovery day 0 (+4 h)", phase: "POST_TEST" },
  { key: "r3", label: "R+3", long: "Recovery day 3", phase: "POST_TEST" },
];

function tpKey(phase, day) {
  const d = String(day).replace(/\s+/g, "").toLowerCase();
  if (phase === "PRE_TEST") return "pre";
  if (phase === "IN_TEST") return `d${parseInt(d, 10)}`;
  if (phase === "POST_TEST") return d.startsWith("0") ? "r0" : `r${parseInt(d, 10)}`;
  return null;
}

const COLS = {
  lvidd: "Left Ventricular Diameter Diastole",
  lvids: "Left Ventricular Diameter Systole",
  pvAt: "Pulmonic Valve Acceleration Time",
  pvEt: "Pulmonic Valve Ejection Time",
  mE: "Mitral E Wave Velocity",
  mA: "Mitral A Wave Velocity",
  mDt: "Mitral Deceleration Time",
  ict: "Isovolumic Contraction Time",
  et: "Ejection Time",
  ivrt: "Isovolumic Relaxation Time",
  tE: "Tricuspid E Velocity",
  tA: "Tricuspid A Velocity",
  tr: "Tricuspid Regurgitation",
  rvS: "TDI Tricuspid Systole",
  hrR: "TDI Right Heart Rate",
  sepS: "TDI Basal Septal Systole",
  sepE: "TDI Basal Septal E",
  latS: "TDI Mitral Annular Systole",
  latE: "TDI Mitral Annular E",
  hrL: "TDI Left Heart Rate",
  vp: "Color M-Mode Velocity Propagation Time",
  vti: "LVOT Velocity Time Integral",
};

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

function build() {
  const all = parseCsv(allCsv);
  const d3 = parseCsv(d3Csv);
  const crewIds = [...new Set(parseCsv(crewCsv).map((r) => r.Subject))];

  const subjects = {};
  const get = (id) => (subjects[id] ??= { id, treatment: null, crew: crewIds.includes(id), tp: {} });

  for (const r of all) {
    const s = get(r.Subject);
    s.treatment = r.Treatment;
    const k = tpKey(r.Test_Phase, r.Day);
    const m = (s.tp[k] ??= {});
    for (const [key, col] of Object.entries(COLS)) m[key] = num(r[col]);
  }

  // 3D: promedio de los dos analistas
  const acc = {};
  for (const r of d3) {
    const k = tpKey(r.Test_Phase, r.BR_Day);
    const a = ((acc[r.Subject] ??= {})[k] ??= { lvMass: [], edv: [], esv: [] });
    const s = get(r.Subject);
    if (!s.treatment && r.Treatment && r.Treatment !== "NA") s.treatment = r.Treatment;
    for (const [key, col] of [["lvMass", "LV mass"], ["edv", "LVDV"], ["esv", "LVSV"]]) {
      const v = num(r[col]);
      if (v != null) a[key].push(v);
    }
    if (r.Comments && r.Comments !== "NA") a.note = r.Comments;
  }
  for (const [id, tps] of Object.entries(acc)) {
    for (const [k, a] of Object.entries(tps)) {
      const m = (subjects[id].tp[k] ??= {});
      m.lvMass = mean(a.lvMass);
      m.edv = mean(a.edv);
      m.esv = mean(a.esv);
      if (a.note) m.note3d = a.note;
    }
  }

  for (const s of Object.values(subjects)) {
    s.treatment ??= "Unassigned";
    for (const m of Object.values(s.tp)) derive(m);
  }
  return { subjects, crewIds };
}

// Métricas derivadas (fórmulas estándar de ecocardiografía)
function derive(m) {
  m.hr = m.hrL ?? m.hrR ?? null;
  m.fs = m.lvidd && m.lvids ? ((m.lvidd - m.lvids) / m.lvidd) * 100 : null;
  m.sv = m.edv && m.esv ? m.edv - m.esv : null;
  m.ef = m.sv && m.edv ? (m.sv / m.edv) * 100 : null;
  m.co = m.sv && m.hr ? (m.sv * m.hr) / 1000 : null;
  m.ea = m.mE && m.mA ? m.mE / m.mA : null;
  const ePrime = mean([m.latE, m.sepE].filter((x) => x != null));
  m.ee = m.mE && ePrime ? m.mE / ePrime : null;
  m.tei = m.ict && m.ivrt && m.et ? (m.ict + m.ivrt) / m.et : null;
  m.rvsp = m.tr ? 4 * (m.tr / 100) ** 2 + 5 : null;
}

export const ECHO = build();
export const SUBJECT_IDS = Object.keys(ECHO.subjects).sort((a, b) =>
  (ECHO.subjects[b].crew - ECHO.subjects[a].crew) || a.localeCompare(b));
export const TREATMENTS = ["Control", "Exercise A", "Exercise B", "Flywheel"];
