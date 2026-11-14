"""Normaliza el catálogo NASA LSDA/NLSP (ya limpio) en tablas relacionales -> data/nasa/.

Entrada: carpeta de trabajo con limpios/, raw/ y resultados/ generada en la fase de limpieza
(por defecto ~/Downloads/Copia de by_topic; cambiar con --src).
Requiere pandas.   python data/scripts/normalize_nasa.py [--src RUTA]
"""
import argparse
import html
import json
import re
from pathlib import Path

import pandas as pd

OUT = Path(__file__).resolve().parents[1] / "nasa"

TOPICS = {  # topic_code -> (nombre, dominio RIDGE)
    "radiation": ("Radiación", "RAD"),
    "behavior_mental": ("Conducta y salud mental", "ISO"),
    "sleep_circadian": ("Sueño y ritmo circadiano", "ISO"),
    "nutrition_metabolism": ("Nutrición y metabolismo", "DIST"),
    "bone_muscle": ("Hueso y músculo", "GRAV"),
    "cardiovascular": ("Cardiovascular", "GRAV"),
    "sensorimotor": ("Sensoriomotor / oído interno", "GRAV"),
    "organs": ("Órganos", "GRAV"),
    "vision_neuro_sans": ("Visión y neuro (SANS)", "GRAV"),
    "exercise_fitness": ("Ejercicio y condición física", "GRAV"),
    "immune": ("Sistema inmune", "ENV"),
    "environment_habitat": ("Ambiente y hábitat", "ENV"),
}
THEME_DOMAIN = {
    "Radiación espacial": "RAD", "Aislamiento y confinamiento (conducta)": "ISO", "Sueño y ritmo circadiano": "ISO",
    "Distancia de la Tierra (comunicación, atención médica, suministros)": "DIST", "Nutrición y metabolismo": "DIST",
    "Gravedad: músculo": "GRAV", "Gravedad: hueso": "GRAV", "Gravedad: oído interno / sensoriomotor": "GRAV",
    "Gravedad: órganos": "GRAV", "Gravedad: cardiovascular": "GRAV", "Visión y neuro": "GRAV",
    "Ambiente cerrado: temperatura, presión, iluminación, aire": "ENV", "Sistema inmune": "ENV",
}
METRIC_RE = {  # para ligar hallazgos a métricas del monitor
    "heart_rate": r"heart rate|\bbpm\b|tachycard|bradycard|palpitation",
    "systolic_bp": r"blood pressure|systolic|mmHg",
    "spo2": r"oxygen saturation|SpO2|hypox",
    "body_temp": r"body temperature|core temperature|fever",
    "resp_rate": r"respiration rate|respiratory rate|breaths",
    "sleep_duration": r"sleep",
    "pvt_mean_rt": r"reaction time|vigilance|PVT",
    "phq9_score": r"mood|depress|POMS|dysphoria|tension",
    "radiation_dose_rate": r"dose|mGy|mSv|\brem\b|radiation",
    "bmd_change_pct_month": r"bone mineral|bone density|bone mass|bone loss|BMD",
    "muscle_strength_change_pct": r"strength|torque",
    "muscle_volume_change_pct": r"muscle (?:volume|mass|size|cross-sectional)|atrophy|fiber (?:size|area)",
    "sot_equilibrium_score": r"postur\w*|balance|equilibrium|sway|vestibul\w*|otolith",
    "urinary_cortisol": r"cortisol|catecholamin\w*|epinephrine|norepinephrine",
    "hrv_rmssd": r"heart rate variability|\bHRV\b",
    "pss10_score": r"perceived stress|psycholog\w* stress|mission stress|emotional stress|anxiety|workload",
    "urinary_calcium": r"urinary calcium|calcium excretion|hypercalciuria|kidney stone|renal stone",
    "motion_sickness_score": r"motion sickness|space adaptation syndrome|nausea",
    "body_mass_change_pct_month": r"body (?:mass|weight)|weight loss",
    "cabin_co2": r"carbon dioxide|\bCO2\b",
    "cabin_co": r"carbon monoxide",
    "cabin_nh3": r"ammonia",
    "cabin_temp": r"cabin temperature|ambient temperature",
    "illumination": r"illumination|lighting|\blux\b",
    "noise_level": r"noise|acoustic",
}
METRIC_RE = {k: re.compile(v, re.I) for k, v in METRIC_RE.items()}
USEFUL_METRIC = {  # métrica del CSV de datasets útiles -> metric_code(s)
    "Frecuencia cardiaca": ["heart_rate"], "respiración": ["resp_rate"], "presión arterial": ["systolic_bp"],
    "PA": ["systolic_bp"], "FC": ["heart_rate"], "temperatura": ["body_temp"], "Arritmias": ["heart_rate"],
    "Tiempo de reacción": ["pvt_mean_rt"], "ortostática": ["hr_orthostatic_increase"], "dosis": ["radiation_dose_rate"],
    "Dosis": ["radiation_dose_rate"], "Peso corporal": ["body_mass_change_pct_month"], "CO₂": ["cabin_co2"],
    "Amoníaco": ["cabin_nh3", "cabin_co"], "Monóxido": ["cabin_co"], "Contaminante": ["cabin_co"],
    "conducta": ["phq9_score"], "Sueño": ["sleep_duration"], "Iluminación": ["illumination"],
    "Temperatura ambiente": ["cabin_temp"], "Temperatura de piel": ["body_temp"], "Calidad del agua": [],
}


def plain(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    if isinstance(v, list):
        v = "; ".join(map(str, v))
    v = html.unescape(str(v)).replace("\x0b", " ")
    v = re.sub(r"<[^>]+>|<end>", " ", v, flags=re.I)
    return re.sub(r"\s+", " ", v).strip(" ;")


def split_ids(v):
    return [i.strip() for i in re.split(r";\s*", str(v)) if i.strip()] if pd.notna(v) else []


def main(src: Path):
    OUT.mkdir(parents=True, exist_ok=True)
    lim = pd.read_csv(src / "limpios" / "datasets_all.csv")
    orig = pd.read_csv(src / "datasets_all.csv")[["nlsp_url", "experiment_id", "availability", "processing_level",
                                                   "file_name", "file_format", "file_size", "release_date"]]
    ds = lim.merge(orig, on="nlsp_url", how="left")
    ds["dataset_id"] = ds.nlsp_url.str.extract(r"/details/([^?/]+)")[0]
    errores = pd.read_csv(src / "resultados" / "errores.csv").set_index("nlsp_url").incidencias
    exps = json.load((src / "raw" / "experimentos.json").open())["documents"]
    exp_res = pd.read_csv(src / "resultados" / "experimentos_resultados.csv")

    # experimentos
    idx = {}
    for x in exps:
        for k in [x.get("experiment_id")] + re.findall(r"'([^']+)'", str(x.get("experiment_identifier", ""))):
            if k:
                idx.setdefault(str(k).strip(), x)
    used = {}
    bridge = []
    for r in ds.itertuples():
        for e in split_ids(r.experiment_id):
            if e in idx:
                used[idx[e]["id"]] = idx[e]
                bridge.append((r.dataset_id, idx[e]["id"]))
    res = exp_res.set_index("experiment_id")
    rows = []
    for key, x in used.items():
        eid = x.get("experiment_id")
        rr = res.loc[eid] if eid in res.index else None
        if isinstance(rr, pd.DataFrame):
            rr = rr.iloc[0]
        rows.append({
            "experiment_key": key, "experiment_id": eid, "title": plain(x.get("experiment_title")),
            "program": plain(x.get("Program")), "species": plain(x.get("species")).strip("[]'"),
            "research_area": plain(x.get("research_area")).strip("[]").replace("'", ""),
            "archive_status": x.get("archive_status"),
            "objectives": rr.objetivos if rr is not None else "", "approach": rr.metodo if rr is not None else "",
            "results": rr.resultados if rr is not None else "",
            "results_source": rr.fuente_resultado if rr is not None else "",
        })
    experiments = pd.DataFrame(rows).fillna("")
    experiments["has_results"] = experiments.results.str.len() > 40
    experiments.to_csv(OUT / "experiments.csv", index=False)
    pd.DataFrame(bridge, columns=["dataset_id", "experiment_key"]).drop_duplicates().to_csv(
        OUT / "dataset_experiments.csv", index=False)

    # datasets
    inc = ds.nlsp_url.map(errores).fillna("")
    out = pd.DataFrame({
        "dataset_id": ds.dataset_id, "name": ds.dataset_name, "species": ds.species,
        "experiment_type": ds.experiment_type, "processing_level": ds.processing_level.map(plain),
        "availability": ds.availability, "file_name": ds.file_name, "file_format": ds.file_format.str.lower(),
        "file_size": ds.file_size, "release_date": ds.release_date, "parameters": ds.parameters,
        "description": ds.description, "nlsp_url": ds.nlsp_url,
    })
    out["is_public"] = ~inc.str.contains("privados|privacy|request|offline|No data|another repository|Not available", case=False) \
        & out.availability.eq("Available online")
    out["is_aggregated"] = out.processing_level.str.contains("Summar|Analy", case=False, na=False)
    out["is_machine_readable"] = out.file_format.fillna("").str.contains(r"xls|csv|txt")
    out.to_csv(OUT / "datasets.csv", index=False)

    # temas y misiones (relaciones N:M)
    pd.DataFrame([(k, n, d) for k, (n, d) in TOPICS.items()], columns=["topic_code", "name_es", "domain_code"]) \
        .to_csv(OUT / "topics.csv", index=False)
    dt = ds[["dataset_id", "health_topics"]].assign(topic_code=ds.health_topics.str.split("; ")).explode("topic_code")
    dt[dt.topic_code.isin(TOPICS)][["dataset_id", "topic_code"]].drop_duplicates() \
        .to_csv(OUT / "dataset_topics.csv", index=False)
    dm = ds[["dataset_id", "mission_id"]].assign(mission_name=ds.mission_id.str.split(r";\s*")).explode("mission_name")
    dm = dm.dropna(subset=["mission_name"])
    dm["mission_name"] = dm.mission_name.str.strip()
    dm[dm.mission_name != ""][["dataset_id", "mission_name"]].drop_duplicates() \
        .to_csv(OUT / "dataset_missions.csv", index=False)

    # evidencia (hallazgos) -> dominio + métrica
    h = pd.read_csv(src / "resultados" / "hallazgos_por_tema.csv")
    key_by_eid = experiments.drop_duplicates("experiment_id").set_index("experiment_id").experiment_key
    h["experiment_key"] = h.experiment_id.map(key_by_eid)
    h = h.dropna(subset=["experiment_key"])
    ev = []
    for r in h.itertuples():
        metrics = [m for m, rx in METRIC_RE.items() if rx.search(r.hallazgo)] or [""]
        for m in metrics:
            ev.append({"experiment_key": r.experiment_key, "domain_code": THEME_DOMAIN[r.tema_monitor],
                       "theme_es": r.tema_monitor, "metric_code": m, "finding_text": r.hallazgo,
                       "is_quantitative": r.cuantitativo, "species": r.especie, "evidence_kind": r.fuente})
    ev = pd.DataFrame(ev).drop_duplicates(["experiment_key", "theme_es", "metric_code", "finding_text"])
    ev.insert(0, "finding_id", [f"EV{i:05d}" for i in range(1, len(ev) + 1)])
    ev.to_csv(OUT / "evidence_findings.csv", index=False)

    # datasets curados para el monitor -> métricas
    u = pd.read_csv(src / "resultados" / "datasets_utiles_monitor.csv")
    u["dataset_id"] = u.nlsp_url.str.extract(r"/details/([^?/]+)")[0]
    links = []
    for r in u.itertuples():
        codes = sorted({c for k, cs in USEFUL_METRIC.items() if k in r.metrica_monitor for c in cs})
        for c in codes:
            links.append({"dataset_id": r.dataset_id, "metric_code": c, "use_es": r.uso_en_monitor,
                          "machine_readable": r.minable_directo})
    pd.DataFrame(links).drop_duplicates(["dataset_id", "metric_code"]).to_csv(OUT / "dataset_metric_links.csv", index=False)

    print(f"experiments={len(experiments)} datasets={len(out)} dataset_topics={len(dt)} "
          f"evidence={len(ev)} metric_links={len(links)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=Path.home() / "Downloads" / "Copia de by_topic")
    main(ap.parse_args().src)
