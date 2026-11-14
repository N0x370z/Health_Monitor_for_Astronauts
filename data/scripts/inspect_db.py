"""Visualiza la base de datos y verifica que cumple los requisitos del monitor.

    pip install -r data/requirements.txt
    python data/scripts/inspect_db.py            # verifica + genera data/db/report.html y lo abre
    python data/scripts/inspect_db.py --no-open  # solo genera el reporte
    python data/scripts/inspect_db.py --rebuild  # reconstruye data/health_monitor.sqlite antes

Sale con código 1 si algún requisito falla (útil en CI).
"""
import argparse
import base64
import html
import io
import re
import sqlite3
import subprocess
import sys
import webbrowser
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_synthetic as G  # noqa: E402
import reference_data as R  # noqa: E402

DATA = Path(__file__).resolve().parents[1]
DB = DATA / "health_monitor.sqlite"
REPORT = DATA / "db" / "report.html"
SCOPE = {m[0] for m in R.METRICS}
COLORS = {"SIM-LEO": "#2a6fdb", "SIM-MOON": "#8a8f98", "SIM-MARS": "#d9542b", "SIM-RETURN": "#2e9e6a"}
STATUS_COLORS = {"normal": "#2e9e6a", "warning": "#e0a400", "critical": "#d43c3c"}
ALLOWED_CREW_COLS = {"crew_code", "mission_code", "role", "baseline_hr", "baseline_sbp", "baseline_dbp",
                     "baseline_temp", "prior_career_dose_msv"}
AREAS = {
    "Temperatura": ["body_temp", "cabin_temp"],
    "Presión": ["cabin_pressure", "systolic_bp", "diastolic_bp"],
    "Cardiovascular": ["heart_rate", "systolic_bp", "diastolic_bp", "hr_orthostatic_increase", "sbp_orthostatic_drop"],
    "Saturación de oxígeno": ["spo2"],
    "Radiación": ["radiation_dose_rate", "dose_rate_spike_ratio", "radiation_dose_30d", "radiation_dose_365d",
                  "radiation_dose_career"],
}

plt.rcParams.update({"figure.dpi": 110, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.grid": True, "grid.alpha": 0.25, "font.size": 9})


# ── utilidades ──────────────────────────────────────────────────────────────
def q(con, sql, *args):
    return con.execute(sql, args).fetchall()


def bands(ax, con, metric, context="any"):
    r = q(con, "SELECT normal_min, normal_max, critical_low, critical_high FROM medical_reference "
               "WHERE metric_code=? AND context=?", metric, context)
    if not r:
        return
    nmin, nmax, clo, chi = r[0]
    if nmin is not None and nmax is not None:
        ax.axhspan(nmin, nmax, color=STATUS_COLORS["normal"], alpha=0.08, lw=0)
    for v in (nmin, nmax):
        if v is not None:
            ax.axhline(v, color=STATUS_COLORS["warning"], ls=":", lw=0.9)
    for v in (clo, chi):
        if v is not None:
            ax.axhline(v, color=STATUS_COLORS["critical"], ls="--", lw=0.9)


def fig_to_img(fig):
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return f'<img alt="" src="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}">'


def hours(ts_list):
    t = [datetime.strptime(x, "%Y-%m-%dT%H:%M:%SZ") for x in ts_list]
    return [(x - t[-1]).total_seconds() / 3600 for x in t]


def series_24h(con, metric, crew=None, mission=None):
    if crew:
        rows = q(con, "SELECT ts, value FROM measurement WHERE crew_code=? AND metric_code=? ORDER BY ts", crew, metric)
    else:
        rows = q(con, "SELECT ts, value FROM measurement WHERE mission_code=? AND crew_code IS NULL AND metric_code=? "
                      "ORDER BY ts", mission, metric)
    return hours([r[0] for r in rows]), [r[1] for r in rows]


# ── requisitos ──────────────────────────────────────────────────────────────
def check_requirements(con):
    res = []

    def add(code, name, ok, detail, warn=False):
        res.append((code, name, "PASS" if ok else ("WARN" if warn else "FAIL"), detail))

    with_data = {r[0] for r in q(con, "SELECT DISTINCT metric_code FROM measurement UNION "
                                      "SELECT DISTINCT metric_code FROM daily_measurement")}
    in_db = {r[0] for r in q(con, "SELECT metric_code FROM metric")}
    extra = (in_db | with_data) - SCOPE
    add("R01", "Alcance: solo temperatura, presión, cardiovascular, SpO2 y radiación", not extra,
        f"{len(in_db)} métricas en la base" + (f"; fuera de alcance: {sorted(extra)}" if extra else ""))

    for i, (area, metrics) in enumerate(AREAS.items(), 2):
        missing = [m for m in metrics if m not in with_data]
        add(f"R{i:02d}", f"{area}: datos de todas sus métricas", not missing,
            ", ".join(metrics) if not missing else f"sin datos: {missing}")

    ctx = {r[0] for r in q(con, "SELECT context FROM medical_reference WHERE metric_code='radiation_dose_rate'")}
    spikes = q(con, "SELECT COUNT(*) FROM measurement WHERE metric_code='dose_rate_spike_ratio' AND status<>'normal'")[0][0]
    add("R07", "Radiación: contextos LEO/Luna/Marte y picos detectados",
        {"leo", "lunar_surface", "mars_transit"} <= ctx and spikes > 0,
        f"contextos={sorted(ctx)}; puntos de pico={spikes}")

    rows = q(con, "SELECT crew_code, COUNT(DISTINCT ts), MIN(ts), MAX(ts) FROM measurement "
                  "WHERE crew_code IS NOT NULL AND metric_code='heart_rate' GROUP BY crew_code")
    ncrew = q(con, "SELECT COUNT(*) FROM crew_member")[0][0]
    add("R08", "Últimas 24 h cada 5 min por tripulante (GET /api/metrics/last-24h)",
        len(rows) == ncrew and all(r[1] >= 288 for r in rows),
        f"{len(rows)}/{ncrew} tripulantes, {min(r[1] for r in rows)} puntos c/u, {rows[0][2]} → {rows[0][3]}" if rows else "sin datos")

    no_ref = [r[0] for r in q(con, "SELECT metric_code FROM metric WHERE metric_code NOT IN "
                                   "(SELECT metric_code FROM medical_reference)")]
    no_src = q(con, "SELECT COUNT(*) FROM medical_reference r LEFT JOIN source s ON s.source_id=r.primary_source_id "
                    "WHERE s.source_id IS NULL")[0][0]
    unknown = q(con, "SELECT (SELECT COUNT(*) FROM measurement WHERE status='unknown') + "
                     "(SELECT COUNT(*) FROM daily_measurement WHERE status='unknown')")[0][0]
    add("R09", "Cada métrica tiene rango de referencia con fuente citada", not no_ref and not no_src and not unknown,
        f"sin referencia={no_ref or 0}; sin fuente={no_src}; mediciones sin estado={unknown}")

    refs, missions = G.load_reference()
    by_m = {m["mission_code"]: m for m in missions}
    bad = 0
    for mission, metric, value, act, st in q(con, "SELECT mission_code, metric_code, value, activity, status FROM measurement"):
        period = "exercise" if act == "exercise" else None
        bad += G.status(G.pick_ref(refs, metric, by_m[mission], period), value) != st
    for mission, metric, value, st in q(con, "SELECT mission_code, metric_code, value, status FROM daily_measurement"):
        period = "daily_mean" if metric == "systolic_bp" else None
        bad += G.status(G.pick_ref(refs, metric, by_m[mission], period), value) != st
    add("R10", "Estados consistentes al recalcular la regla de alerta (todas las mediciones)", bad == 0,
        f"discrepancias={bad}")

    cols = {r[1] for r in q(con, "PRAGMA table_info(crew_member)")}
    codes_ok = all(re.fullmatch(r"CREW-[A-Z]+-\d{2}", r[0]) for r in q(con, "SELECT crew_code FROM crew_member"))
    add("R11", "Sin datos personales (sin nombres, edades ni identificadores)", cols <= ALLOWED_CREW_COLS and codes_ok,
        f"columnas de tripulante={sorted(cols)}")

    fk = q(con, "PRAGMA foreign_key_check")
    dup = q(con, "SELECT COUNT(*) FROM (SELECT ts, crew_code, metric_code, mission_code, COUNT(*) c FROM measurement "
                 "GROUP BY 1,2,3,4 HAVING c>1)")[0][0]
    add("R12", "Integridad: llaves foráneas y sin duplicados", not fk and dup == 0, f"FK rotas={len(fk)}; duplicados={dup}")

    ev = q(con, "SELECT e.event_id, SUM(CASE WHEN x.status<>'normal' THEN 1 ELSE 0 END), COUNT(x.event_id) FROM event e "
                "LEFT JOIN (SELECT event_id, status FROM measurement UNION ALL SELECT event_id, status FROM daily_measurement) x "
                "ON x.event_id=e.event_id GROUP BY e.event_id")
    add("R13", "Cada anomalía inyectada genera al menos una alerta", all(f for _, f, _ in ev),
        ", ".join(f"{e}: {f}/{n}" for e, f, n in ev))

    cited = {r[0] for r in q(con, "SELECT metric_code FROM nasa_evidence_finding UNION "
                                  "SELECT metric_code FROM nasa_dataset_metric_link")}
    area_wo = [a for a, ms in AREAS.items() if not cited & set(ms)]
    add("R14", "Cada área tiene datos reales NASA citables (evidencia o dataset)", not area_wo,
        f"métricas con respaldo NASA: {sorted(cited & SCOPE)}" if not area_wo else f"sin respaldo: {area_wo}")

    nv = q(con, "SELECT metric_code || ' (' || context || ')' FROM medical_reference WHERE confidence='needs_verification'")
    add("R15", "Umbrales verificados contra su fuente", not nv,
        f"pendientes: {', '.join(r[0] for r in nv)}" if nv else "todos", warn=True)
    return res


# ── gráficas ────────────────────────────────────────────────────────────────
def chart_radiation(con):
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.6))
    ax = axes[0]
    for m in COLORS:
        x, y = series_24h(con, "radiation_dose_rate", mission=m)
        ax.plot(x, y, lw=1, color=COLORS[m], label=m)
    ax.set_yscale("log")
    ax.set(title="Tasa de dosis, últimas 24 h (picos SAA en LEO, evento solar en Marte)", xlabel="horas", ylabel="mSv/día")
    ax.legend(fontsize=7)
    ax = axes[1]
    rows = q(con, "SELECT d.crew_code, d.value, d.mission_code FROM daily_measurement d JOIN mission m USING(mission_code) "
                  "WHERE d.metric_code='radiation_dose_career' AND d.mission_day=m.current_mission_day ORDER BY d.crew_code")
    ax.barh([r[0] for r in rows], [r[1] for r in rows], color=[COLORS[r[2]] for r in rows])
    ax.axvline(600, color=STATUS_COLORS["critical"], ls="--", lw=1, label="límite de carrera 600 mSv")
    ax.axvline(480, color=STATUS_COLORS["warning"], ls=":", lw=1, label="80 %")
    ax.set(title="Dosis de carrera acumulada por tripulante", xlabel="mSv")
    ax.legend(fontsize=7)
    return fig_to_img(fig)


def chart_cardio(con):
    fig, axes = plt.subplots(2, 2, figsize=(11, 6.6))
    ax = axes[0, 0]
    bands(ax, con, "heart_rate")
    for (crew,) in q(con, "SELECT crew_code FROM crew_member WHERE mission_code='SIM-LEO'"):
        x, y = series_24h(con, "heart_rate", crew=crew)
        ax.plot(x, y, lw=1.6 if crew == "CREW-LEO-02" else 0.6, label=crew)
    ax.set(title="FC SIM-LEO, 24 h (CREW-LEO-02: palpitaciones, EVT01)", xlabel="horas", ylabel="lpm")
    ax.legend(fontsize=6, ncol=2)
    ax = axes[0, 1]
    for metric, ctx, color in (("systolic_bp", "daily_mean", "#2a6fdb"), ("diastolic_bp", "any", "#7a5cc4")):
        bands(ax, con, metric, ctx)
        for (crew,) in q(con, "SELECT crew_code FROM crew_member WHERE mission_code='SIM-LEO'"):
            rows = q(con, "SELECT mission_day, value FROM daily_measurement WHERE crew_code=? AND metric_code=? "
                          "AND mission_day>90 ORDER BY mission_day", crew, metric)
            hi = crew == "CREW-LEO-03"
            ax.plot([r[0] for r in rows], [r[1] for r in rows], color=color, lw=1.8 if hi else 0.5,
                    alpha=1 if hi else 0.4, label=f"{crew} {metric}" if hi else None)
    ax.set(title="PA media diaria SIM-LEO (CREW-LEO-03 en ascenso, EVT08)", xlabel="día de misión", ylabel="mmHg")
    ax.legend(fontsize=6)
    for ax, metric, title in ((axes[1, 0], "hr_orthostatic_increase", "FC al ponerse de pie, +lpm"),
                              (axes[1, 1], "sbp_orthostatic_drop", "Caída de PAS de pie, mmHg")):
        bands(ax, con, metric, "post_landing")
        for mission in ("SIM-MOON", "SIM-RETURN"):
            rows = q(con, "SELECT mission_day, AVG(value) FROM daily_measurement WHERE mission_code=? AND metric_code=? "
                          "GROUP BY mission_day ORDER BY mission_day", mission, metric)
            ax.plot([r[0] for r in rows], [r[1] for r in rows], marker="o", ms=3, color=COLORS[mission], label=mission)
        ax.set(title=f"{title} (1/6 g y regreso a 1 g)", xlabel="días tras el cambio de gravedad")
        ax.legend(fontsize=7)
    return fig_to_img(fig)


def chart_temp_spo2(con):
    fig, axes = plt.subplots(1, 3, figsize=(12.5, 3.6))
    ax = axes[0]
    bands(ax, con, "body_temp")
    for (crew,) in q(con, "SELECT crew_code FROM crew_member WHERE mission_code='SIM-MARS'"):
        x, y = series_24h(con, "body_temp", crew=crew)
        ax.plot(x, y, lw=1.6 if crew == "CREW-MARS-03" else 0.6, label=crew)
    ax.set(title="Temperatura corporal SIM-MARS (fiebre, EVT03)", xlabel="horas", ylabel="°C")
    ax.legend(fontsize=6)
    ax = axes[1]
    bands(ax, con, "cabin_temp", "crew_cabin")
    for m in COLORS:
        x, y = series_24h(con, "cabin_temp", mission=m)
        ax.plot(x, y, lw=1, color=COLORS[m], label=m)
    ax.set(title="Temperatura de cabina (falla térmica en LEO, EVT05)", xlabel="horas", ylabel="°C")
    ax.legend(fontsize=6)
    ax = axes[2]
    bands(ax, con, "spo2")
    for (crew,) in q(con, "SELECT crew_code FROM crew_member WHERE mission_code='SIM-MARS'"):
        x, y = series_24h(con, "spo2", crew=crew)
        ax.plot(x, y, lw=1.6 if crew == "CREW-MARS-03" else 0.6, label=crew)
    ax.set(title="Saturación de oxígeno SIM-MARS (infección, EVT03)", xlabel="horas", ylabel="%")
    ax.legend(fontsize=6)
    return fig_to_img(fig)


def chart_pressure(con):
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.4))
    ax = axes[0]
    bands(ax, con, "cabin_pressure", "crew_cabin")
    for m in COLORS:
        x, y = series_24h(con, "cabin_pressure", mission=m)
        ax.plot(x, y, lw=1, color=COLORS[m], label=m)
    ax.set(title="Presión de cabina (fuga lenta en la Luna, EVT04)", xlabel="horas", ylabel="kPa")
    ax.legend(fontsize=6)
    ax = axes[1]
    bands(ax, con, "systolic_bp")
    for metric, color, label in (("systolic_bp", "#2a6fdb", "sistólica"), ("diastolic_bp", "#7a5cc4", "diastólica")):
        x, y = series_24h(con, metric, crew="CREW-MARS-01")
        ax.plot(x, y, lw=0.9, color=color, label=label)
    ax.set(title="Presión arterial 24 h, CREW-MARS-01 (picos = ejercicio)", xlabel="horas", ylabel="mmHg")
    ax.legend(fontsize=6)
    return fig_to_img(fig)


def chart_alerts(con):
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.4))
    ax = axes[0]
    names = list(AREAS)
    counts = {a: {"warning": 0, "critical": 0} for a in names}
    for metric, st, n in q(con, "SELECT metric_code, status, COUNT(*) FROM (SELECT metric_code, status FROM measurement "
                                "UNION ALL SELECT metric_code, status FROM daily_measurement) "
                                "WHERE status IN ('warning','critical') GROUP BY 1, 2"):
        for a, ms in AREAS.items():
            if metric in ms:
                counts[a][st] += n
    left = [0] * len(names)
    for s in ("warning", "critical"):
        vals = [counts[a][s] for a in names]
        ax.barh(names, vals, left=left, color=STATUS_COLORS[s], label=s)
        left = [a + b for a, b in zip(left, vals)]
    ax.set(title="Alertas por área (la PA cuenta en presión y en cardiovascular)", xlabel="mediciones")
    ax.legend(fontsize=7)
    ax = axes[1]
    ev = q(con, "SELECT e.event_id, 100.0*SUM(CASE WHEN x.status<>'normal' THEN 1 ELSE 0 END)/COUNT(*) FROM event e JOIN "
                "(SELECT event_id, status FROM measurement UNION ALL SELECT event_id, status FROM daily_measurement) x "
                "ON x.event_id=e.event_id GROUP BY e.event_id ORDER BY e.event_id")
    ax.bar([r[0] for r in ev], [r[1] for r in ev], color="#2a6fdb")
    ax.set(title="% de puntos de cada evento marcados como alerta", ylabel="%", ylim=(0, 100))
    ax.tick_params(axis="x", rotation=45)
    return fig_to_img(fig)


# ── reporte ─────────────────────────────────────────────────────────────────
def table(rows, headers):
    th = "".join(f"<th>{html.escape(h)}</th>" for h in headers)
    body = "".join("<tr>" + "".join(f"<td class='{c if c in ('PASS', 'WARN', 'FAIL') else ''}'>{html.escape(str(c))}</td>"
                                    for c in r) + "</tr>" for r in rows)
    return f"<div class='scroll'><table><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table></div>"


def build_report(con, reqs):
    counts = [(t, q(con, f"SELECT COUNT(*) FROM {t}")[0][0]) for (t,) in
              q(con, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    refs = q(con, "SELECT r.metric_code, r.context, r.normal_min, r.normal_max, r.critical_low, r.critical_high, "
                  "r.confidence, s.citation FROM medical_reference r JOIN source s ON s.source_id=r.primary_source_id "
                  "ORDER BY r.metric_code, r.context")
    events = q(con, "SELECT event_id, mission_code, COALESCE(crew_code,'módulo/todos'), event_type, description_es FROM event")
    sections = [("Radiación", chart_radiation(con)), ("Cardiovascular", chart_cardio(con)),
                ("Temperatura y saturación de oxígeno", chart_temp_spo2(con)), ("Presión", chart_pressure(con)),
                ("Alertas y detección", chart_alerts(con))]
    n_fail = sum(r[2] == "FAIL" for r in reqs)
    verdict = "Cumple todos los requisitos" if n_fail == 0 else f"{n_fail} requisito(s) sin cumplir"
    css = """
    :root{--bg:#fff;--fg:#1d2330;--mut:#5d6675;--line:#e3e6eb;--card:#f7f8fa}
    @media (prefers-color-scheme:dark){:root{--bg:#14171c;--fg:#e8eaee;--mut:#9aa3b2;--line:#2a2f37;--card:#1b1f26}}
    body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:0 auto;padding:24px 16px;max-width:1200px}
    h1{font-size:22px;margin:0 0 4px} h2{font-size:17px;margin:28px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
    .mut{color:var(--mut)} .scroll{overflow-x:auto} table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}
    th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
    th{background:var(--card)} td.PASS{color:#2e9e6a;font-weight:600} td.WARN{color:#c58f00;font-weight:600} td.FAIL{color:#d43c3c;font-weight:600}
    img{max-width:100%;background:#fff;border-radius:6px;border:1px solid var(--line)}
    .verdict{display:inline-block;padding:4px 10px;border-radius:6px;background:var(--card);font-weight:600}
    """
    parts = [f"<!doctype html><html lang='es'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
             f"<title>Health Monitor DB</title><style>{css}</style></head><body>",
             "<h1>Health Monitor for Astronauts — base de datos</h1>",
             f"<p class='mut'>{DB.relative_to(DATA.parent)} · temperatura, presión, cardiovascular, SpO2 y radiación · "
             "datos sintéticos calibrados con guías clínicas y NASA LSDA · sin datos personales · fuentes en docs/DATA_SOURCES.md</p>",
             f"<p class='verdict'>{verdict}</p>",
             "<h2>Requisitos</h2>", table(reqs, ["ID", "Requisito", "Estado", "Detalle"])]
    for title, img in sections:
        parts += [f"<h2>{title}</h2>", img]
    parts += ["<h2>Rangos de referencia y fuente</h2>",
              table(refs, ["Métrica", "Contexto", "Normal mín", "Normal máx", "Crítico bajo", "Crítico alto", "Confianza", "Fuente"]),
              "<h2>Eventos inyectados (verdad de referencia)</h2>",
              table(events, ["Evento", "Misión", "Tripulante", "Tipo", "Descripción"]),
              "<h2>Tablas</h2>", table(counts, ["Tabla", "Filas"]), "</body></html>"]
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text("".join(parts), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-open", action="store_true", help="no abrir el reporte en el navegador")
    ap.add_argument("--rebuild", action="store_true", help="reconstruir la base antes de verificar")
    a = ap.parse_args()
    if a.rebuild or not DB.exists():
        subprocess.run([sys.executable, str(DATA / "scripts" / "build_db.py")], check=True)
    con = sqlite3.connect(DB)
    con.execute("PRAGMA foreign_keys = ON")
    reqs = check_requirements(con)
    width = max(len(r[1]) for r in reqs)
    print(f"\n{'ID':4} {'Requisito':{width}}  Estado")
    for code, name, st, detail in reqs:
        print(f"{code:4} {name:{width}}  {st}\n     └ {detail}")
    build_report(con, reqs)
    print(f"\nReporte: {REPORT}")
    if not a.no_open:
        webbrowser.open(REPORT.as_uri())
    sys.exit(1 if any(r[2] == "FAIL" for r in reqs) else 0)


if __name__ == "__main__":
    main()
