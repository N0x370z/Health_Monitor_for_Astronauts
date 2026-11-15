// Evidencia: datasets/experimentos reales de NASA Life Sciences Portal (NLSP).
// Fuente: snapshot de NLSP (2026-11-14). Cada alerta cita una de estas entradas.
const D = (id) => `https://nlsp.nasa.gov/explore/data/details/${id}?dataType=DATASETS`;
const E = (id) => `https://nlsp.nasa.gov/explore/data/details/${id}?dataType=EXPERIMENTS`;

export const EVIDENCE = {
  radMir: {
    id: "JMMIR9401620_69",
    title: "Absorbed doses & mean dose rates, area passive dosimeters",
    mission: "NASA-2 / Mir 21",
    url: D("IDP-LSDA_DATASET-0000000000001416"),
  },
  radSkylab: {
    id: "skych__1760452853",
    title: "Mean daily radiation dose rates (1st, 2nd, 3rd visits)",
    mission: "Skylab 2–4",
    url: D("IDP-LSDA_DATASET-0000000000001534"),
  },
  radApollo: {
    id: "JMAPAP003_245",
    title: "Average radiation dose of flight crews, Apollo 7–15",
    mission: "Apollo",
    url: D("IDP-LSDA_DATASET-0000000000000667"),
  },
  co2: {
    id: "JMGROUNDLMLSTP41_694",
    title: "Carbon dioxide in the Phase II 30-day closed-chamber test",
    mission: "LMLSTP (ground analog)",
    url: D("IDP-LSDA_DATASET-0000000000001094"),
  },
  holter: {
    id: "JMDSO_463_2",
    title: "In-flight Holter monitoring — intrasubject variability",
    mission: "STS-30/33/36/44/61C",
    url: D("IDP-LSDA_DATASET-0000000000000142"),
  },
  bp: {
    id: "J0001142",
    title: "Arterial pressure response to entry and landing",
    mission: "STS-71",
    url: D("IDP-LSDA_DATASET-0000000000001890"),
  },
  sleepDur: {
    id: "NEEMO_ACTIWATCH__1820735945",
    title: "Average sleep duration (actigraphy)",
    mission: "NEEMO 5 (isolation analog)",
    url: D("IDP-LSDA_DATASET-0000000000002317"),
  },
  sleepEff: {
    id: "NEEMO_ACTIWATCH__1820813971",
    title: "Average sleep efficiency (actigraphy)",
    mission: "NEEMO 5",
    url: D("IDP-LSDA_DATASET-0000000000002433"),
  },
  mood: {
    id: "9401628__2731259720",
    title: "Crewmember & crew-ground interactions — supervisor support",
    mission: "NASA-Mir (Mir 22–24)",
    url: D("IDP-LSDA_DATASET-0000000000001337"),
  },
  bone: {
    id: "NNX08AQ20G__31107109",
    title: "BMD changes: immediately and ~12 months postflight",
    mission: "Long-duration crews",
    url: D("IDP-LSDA_DATASET-0000000000001451"),
  },
  immune: {
    id: "J0000954",
    title: "Lymphocyte counts of Apollo 7–13 missions",
    mission: "Apollo",
    url: D("IDP-LSDA_DATASET-0000000000000253"),
  },
  sans: {
    id: "Ocular_Health",
    title: "Prospective observational study of ocular health in ISS crews",
    mission: "ISS",
    url: E("eec9b3e3-45e3-5fe9-8907-92d81a1bc3eb"),
  },
};
