"""Normaliza el catálogo NASA LSDA/NLSP (ya limpio) en tablas relacionales -> data/nasa/ (CSV ignorados por git).

Alcance: solo registros relacionados con temperatura, presión, cardiovascular, saturación de oxígeno y radiación.
Entrada: carpeta de trabajo con limpios/, raw/ y resultados/ generada en la fase de limpieza
(ver docs/DATA_SOURCES.md; por defecto ~/Downloads/Copia de by_topic, cambiar con --src).
Requiere pandas.   python data/scripts/normalize_nasa.py [--src RUTA]
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import reference_data as R  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "nasa"

TOPICS = {  # topic_code -> (nombre, dominio)
    "radiation": ("Radiación", "RAD"),
    "cardiovascular": ("Cardiovascular", "GRAV"),
    "environment_habitat": ("Ambiente y hábitat", "ENV"),
}
METRIC_DOMAIN = {m[0]: m[4] for m in R.METRICS}
METRIC_RE = {  # liga hallazgos y datasets a las métricas del monitor
    "heart_rate": r"heart rate|\bbpm\b|tachycard\w*|bradycard\w*|palpitation\w*|arrhythmi\w*|\bECG\b|electrocardio\w*",
    "systolic_bp": r"blood pressure|systolic|diastolic|hypertens\w*|hypotens\w*",
    "hr_orthostatic_increase": r"orthostatic|\bLBNP\b|lower body negative pressure|stand test|tilt test",
    "spo2": r"oxygen saturation|\bSpO2\b|hypox\w*|desaturat\w*",
    "body_temp": r"body temperature|core temperature|skin temperature|rectal temperature|fever",
    "cabin_temp": r"cabin temperature|ambient temperature|air temperature|thermal control",
    "cabin_pressure": r"cabin pressure|atmospheric pressure|total pressure|depressuri\w*|decompression",
    "radiation_dose_rate": r"radiation|dose rate|dosimet\w*|absorbed dose|\bmGy\b|\bmSv\b|\bLET\b|heavy ions?|South Atlantic Anomaly|\bSAA\b|solar particle",
}
METRIC_RE = {k: re.compile(v, re.I) for k, v in METRIC_RE.items()}
KEEP_TOPICS = {"radiation", "cardiovascular"}


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


def metrics_in(text):
    return [m for m, rx in METRIC_RE.items() if rx.search(text or "")]


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

    # ── datasets dentro del alcance ──
    text = ds.dataset_name.fillna("") + " " + ds.parameters.fillna("") + " " + ds.description.fillna("")
    topics = ds.health_topics.fillna("").str.split("; ")
    in_scope = topics.map(lambda t: bool(KEEP_TOPICS & set(t))) | text.map(lambda t: bool(metrics_in(t)))
    ds = ds[in_scope].copy()
    inc = ds.nlsp_url.map(errores).fillna("")
    datasets = pd.DataFrame({
        "dataset_id": ds.dataset_id, "name": ds.dataset_name, "species": ds.species,
        "experiment_type": ds.experiment_type, "processing_level": ds.processing_level.map(plain),
        "availability": ds.availability, "file_name": ds.file_name, "file_format": ds.file_format.str.lower(),
        "file_size": ds.file_size, "release_date": ds.release_date, "parameters": ds.parameters,
        "description": ds.description, "nlsp_url": ds.nlsp_url,
    })
    datasets["is_public"] = ~inc.str.contains("privados|privacy|request|offline|No data|another repository|Not available",
                                              case=False) & datasets.availability.eq("Available online")
    datasets["is_aggregated"] = datasets.processing_level.str.contains("Summar|Analy", case=False, na=False)
    datasets["is_machine_readable"] = datasets.file_format.fillna("").str.contains(r"xls|csv|txt")

    # ── experimentos ligados ──
    idx = {}
    for x in exps:
        for k in [x.get("experiment_id")] + re.findall(r"'([^']+)'", str(x.get("experiment_identifier", ""))):
            if k:
                idx.setdefault(str(k).strip(), x)
    used, bridge = {}, []
    for r in ds.itertuples():
        for e in split_ids(r.experiment_id):
            if e in idx:
                used[idx[e]["id"]] = idx[e]
                bridge.append((r.dataset_id, idx[e]["id"]))
    res = exp_res.drop_duplicates("experiment_id").set_index("experiment_id")
    rows = []
    for key, x in used.items():
        eid = x.get("experiment_id")
        rr = res.loc[eid] if eid in res.index else None
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

    # ── evidencia: oraciones de resultados ligadas a una métrica del alcance ──
    h = pd.read_csv(src / "resultados" / "hallazgos_por_tema.csv").drop_duplicates(["experiment_id", "hallazgo"])
    key_by_eid = experiments.drop_duplicates("experiment_id").set_index("experiment_id").experiment_key
    ev = []
    for r in h.itertuples():
        key = key_by_eid.get(r.experiment_id)
        if key is None:
            continue
        for m in metrics_in(r.hallazgo):
            ev.append({"experiment_key": key, "domain_code": METRIC_DOMAIN[m], "theme_es": r.tema_monitor,
                       "metric_code": m, "finding_text": r.hallazgo, "is_quantitative": r.cuantitativo,
                       "species": r.especie, "evidence_kind": r.fuente})
    ev = pd.DataFrame(ev).drop_duplicates(["experiment_key", "metric_code", "finding_text"])
    ev.insert(0, "finding_id", [f"EV{i:05d}" for i in range(1, len(ev) + 1)])

    # ── relaciones N:M ──
    dt = ds[["dataset_id"]].assign(topic_code=topics[in_scope]).explode("topic_code")
    dt = dt[dt.topic_code.isin(TOPICS)].drop_duplicates()
    dm = ds[["dataset_id"]].assign(mission_name=ds.mission_id.str.split(r";\s*")).explode("mission_name").dropna()
    dm["mission_name"] = dm.mission_name.str.strip()
    dm = dm[dm.mission_name != ""].drop_duplicates()
    links = []
    for r in ds.itertuples():
        t = f"{r.dataset_name} {r.parameters} {r.description}"
        for m in metrics_in(t):
            links.append({"dataset_id": r.dataset_id, "metric_code": m,
                          "use_es": "Datos reales relacionados con la métrica",
                          "machine_readable": bool(re.search(r"xls|csv|txt", str(r.file_format), re.I))})

    # ── escritura ──
    pd.DataFrame([(k, n, d) for k, (n, d) in TOPICS.items()], columns=["topic_code", "name_es", "domain_code"]) \
        .to_csv(OUT / "topics.csv", index=False)
    datasets.to_csv(OUT / "datasets.csv", index=False)
    experiments.to_csv(OUT / "experiments.csv", index=False)
    pd.DataFrame(bridge, columns=["dataset_id", "experiment_key"]).drop_duplicates() \
        .to_csv(OUT / "dataset_experiments.csv", index=False)
    dt.to_csv(OUT / "dataset_topics.csv", index=False)
    dm.to_csv(OUT / "dataset_missions.csv", index=False)
    ev.to_csv(OUT / "evidence_findings.csv", index=False)
    pd.DataFrame(links).drop_duplicates(["dataset_id", "metric_code"]).to_csv(OUT / "dataset_metric_links.csv", index=False)
    print(f"datasets={len(datasets)} experiments={len(experiments)} evidence={len(ev)} "
          f"metric_links={len(links)} topics={len(dt)} missions={len(dm)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=Path.home() / "Downloads" / "Copia de by_topic")
    main(ap.parse_args().src)
