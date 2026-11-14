"""Visualiza la base de datos y verifica que cumple los requisitos del monitor.

    pip install matplotlib
    python data/scripts/inspect_db.py            # verifica + genera data/db/report.html y lo abre
    python data/scripts/inspect_db.py --no-open  # solo genera el reporte

Si data/db/health_monitor.sqlite no existe, la construye con build_db.py.
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
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

DATA = Path(__file__).resolve().parents[1]
DB = DATA / "db" / "health_monitor.sqlite"
REPORT = DATA / "db" / "report.html"
DOMAINS = ["RAD", "ISO", "DIST", "GRAV", "ENV"]
COLORS = {"SIM-LEO": "#2a6fdb", "SIM-MOON": "#8a8f98", "SIM-MARS": "#d9542b", "SIM-RETURN": "#2e9e6a"}
STATUS_COLORS = {"normal": "#2e9e6a", "warning": "#e0a400", "critical": "#d43c3c"}
ALLOWED_CREW_COLS = {"crew_code", "mission_code", "role", "baseline_hr", "baseline_sbp", "baseline_dbp",
                     "baseline_temp", "baseline_resp", "prior_career_dose_msv"}

plt.rcParams.update({"figure.dpi": 110, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.grid": True, "grid.alpha": 0.25, "font.size": 9})


# ── utilidades ──────────────────────────────────────────────────────────────
def q(con, sql, *args):
    return con.execute(sql, args).fetchall()


def ref(con, metric, context="any"):
    r = q(con, "SELECT normal_min, normal_max, critical_low, critical_high FROM medical_reference "
               "WHERE metric_code=? AND context=?", metric, context)
    return r[0] if r else (None, None, None, None)


def bands(ax, con, metric, context="any"):
    nmin, nmax, clo, chi = ref(con, metric, context)
    if nmin is not None and nmax is not None:
        ax.axhspan(nmin, nmax, color=STATUS_COLORS["normal"], alpha=0.08, lw=0)
    for v in (clo, chi):
        if v is not None:
            ax.axhline(v, color=STATUS_COLORS["critical"], ls="--", lw=0.9)
    for v in (nmin, nmax):
        if v is not None:
            ax.axhline(v, color=STATUS_COLORS["warning"], ls=":", lw=0.9)


def fig_to_img(fig):
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return f'<img src="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}">'


def hours(ts_list):
    from datetime import datetime
    t = [datetime.strptime(t, "%Y-%m-%dT%H:%M:%SZ") for t in ts_list]
    return [(x - t[-1]).total_seconds() / 3600 for x in t]


def recompute_status(r, v):
    nmin, nmax, clo, chi = r
    if (clo is not None and v <= clo) or (chi is not None and v >= chi):
        return "critical"
    if (nmin is not None and v < nmin) or (nmax is not None and v > nmax):
        return "warning"
    return "normal"


# ── requisitos ──────────────────────────────────────────────────────────────
def check_requirements(con):
    res = []

    def add(code, name, ok, detail, warn=False):
        res.append((code, name, "PASS" if ok else ("WARN" if warn else "FAIL"), detail))

    def has_data(metrics):
        got = {r[0] for r in q(con, "SELECT DISTINCT metric_code FROM measurement UNION "
                                    "SELECT DISTINCT metric_code FROM daily_measurement")}
        return [m for m in metrics if m not in got]

    # R01 cinco dominios
    missing = []
    for d in DOMAINS:
        n_ref = q(con, "SELECT COUNT(*) FROM medical_reference r JOIN metric m USING(metric_code) WHERE m.domain_code=?", d)[0][0]
        n_dat = q(con, "SELECT COUNT(*) FROM (SELECT metric_code FROM measurement UNION ALL SELECT metric_code FROM daily_measurement) x "
                       "JOIN metric m USING(metric_code) WHERE m.domain_code=?", d)[0][0]
        n_ev = q(con, "SELECT COUNT(*) FROM nasa_evidence_finding WHERE domain_code=?", d)[0][0]
        if not (n_ref and n_dat and n_ev):
            missing.append(f"{d}(ref={n_ref},datos={n_dat},evid={n_ev})")
    add("R01", "Cubre los 5 riesgos NASA (RAD, ISO, DIST, GRAV, ENV)", not missing,
        "referencias, datos y evidencia en los 5 dominios" if not missing else "faltan: " + ", ".join(missing))

    # R02 radiación
    ctx = {r[0] for r in q(con, "SELECT context FROM medical_reference WHERE metric_code='radiation_dose_rate'")}
    spikes = q(con, "SELECT COUNT(*) FROM measurement WHERE metric_code='dose_rate_spike_ratio' AND status<>'normal'")[0][0]
    career = q(con, "SELECT critical_high FROM medical_reference WHERE metric_code='radiation_dose_career'")
    miss = has_data(["radiation_dose_rate", "dose_rate_spike_ratio", "radiation_dose_30d", "radiation_dose_365d", "radiation_dose_career"])
    ok = not miss and {"leo", "lunar_surface", "mars_transit"} <= ctx and spikes > 0 and career and career[0][0] == 600
    add("R02", "Radiación: tasa 5 min, picos, dosis acumulada y límites", ok,
        f"contextos={sorted(ctx)}; puntos de pico={spikes}; límite carrera={career[0][0] if career else '—'} mSv"
        + (f"; sin datos: {miss}" if miss else ""))

    # R03-R05 cuerpo
    for code, name, mets in (("R03", "Músculo: fuerza y volumen", ["muscle_strength_change_pct", "muscle_volume_change_pct", "exercise_minutes"]),
                             ("R04", "Hueso y riñón: DMO y calcio urinario", ["bmd_change_pct_month", "urinary_calcium"]),
                             ("R05", "Oído interno: mareo espacial y equilibrio", ["motion_sickness_score", "sot_equilibrium_score"]),
                             ("R06", "Corazón: FC/palpitaciones, PA y ortostatismo", ["heart_rate", "systolic_bp", "diastolic_bp", "hr_orthostatic_increase", "sbp_orthostatic_drop"])):
        miss = has_data(mets)
        add(code, name, not miss, "datos en " + ", ".join(mets) if not miss else f"sin datos: {miss}")

    # R07 adaptación a gravedades
    g = q(con, "SELECT DISTINCT m.gravity_g FROM mission m JOIN daily_measurement d USING(mission_code) "
               "WHERE d.metric_code IN ('sot_equilibrium_score','hr_orthostatic_increase','motion_sickness_score')")
    gs = sorted({r[0] for r in g})
    add("R07", "Adaptación a nuevas gravedades (0 g, 1/6 g y regreso a 1 g)", {0.0, 0.166, 1.0} <= set(gs),
        f"niveles de gravedad con datos de adaptación: {gs}")

    # R08 estrés
    miss = has_data(["urinary_cortisol", "hrv_rmssd", "pss10_score", "phq9_score", "gad7_score"])
    add("R08", "Estrés fisiológico (cortisol, HRV) y psicológico (PSS-10, PHQ-9, GAD-7)", not miss,
        "5 marcadores con datos" if not miss else f"sin datos: {miss}")

    # R09 últimas 24 h
    rows = q(con, "SELECT crew_code, COUNT(DISTINCT ts), MIN(ts), MAX(ts) FROM measurement "
                  "WHERE crew_code IS NOT NULL AND metric_code='heart_rate' GROUP BY crew_code")
    ncrew = q(con, "SELECT COUNT(*) FROM crew_member")[0][0]
    ok = len(rows) == ncrew and all(r[1] >= 288 for r in rows)
    add("R09", "Últimas 24 h cada 5 min para cada tripulante (GET /api/metrics/last-24h)", ok,
        f"{len(rows)}/{ncrew} tripulantes, {min(r[1] for r in rows) if rows else 0} puntos c/u, ventana {rows[0][2]} → {rows[0][3]}" if rows else "sin datos")

    # R10 referencia y fuente por métrica
    no_ref = [r[0] for r in q(con, "SELECT metric_code FROM metric WHERE metric_code NOT IN (SELECT metric_code FROM medical_reference)")]
    unknown = q(con, "SELECT (SELECT COUNT(*) FROM measurement WHERE status='unknown') + (SELECT COUNT(*) FROM daily_measurement WHERE status='unknown')")[0][0]
    add("R10", "Cada métrica tiene rango de referencia con fuente", not no_ref and unknown == 0,
        f"métricas sin referencia={no_ref or 0}; mediciones sin estado={unknown}")

    # R11 consistencia del estado
    refs = {}
    for metric, context, *b in q(con, "SELECT metric_code, context, normal_min, normal_max, critical_low, critical_high FROM medical_reference"):
        refs.setdefault(metric, {})[context] = tuple(b)
    bad = 0
    for metric, value, st in q(con, "SELECT metric_code, value, status FROM measurement WHERE crew_code IS NOT NULL AND activity='sleep' "
                                    "AND metric_code IN ('heart_rate','spo2','resp_rate','body_temp')"):
        if recompute_status(refs[metric]["any"], value) != st:
            bad += 1
    add("R11", "Estados consistentes con la regla de alerta", bad == 0, f"discrepancias al recalcular={bad}")

    # R12 sin datos personales
    cols = {r[1] for r in q(con, "PRAGMA table_info(crew_member)")}
    codes_ok = all(re.fullmatch(r"CREW-[A-Z]+-\d{2}", r[0]) for r in q(con, "SELECT crew_code FROM crew_member"))
    extra = cols - ALLOWED_CREW_COLS
    add("R12", "Sin datos personales (sin nombres, edades ni identificadores)", not extra and codes_ok,
        f"columnas de tripulante={sorted(cols)}" if not extra else f"columnas no permitidas: {extra}")

    # R13 integridad
    fk = q(con, "PRAGMA foreign_key_check")
    dup = q(con, "SELECT COUNT(*) FROM (SELECT ts, crew_code, metric_code, mission_code, COUNT(*) c FROM measurement "
                 "GROUP BY 1,2,3,4 HAVING c>1)")[0][0]
    add("R13", "Integridad: llaves foráneas y sin duplicados", not fk and dup == 0, f"FK rotas={len(fk)}; duplicados={dup}")

    # R14 detección de anomalías
    ev = q(con, "SELECT e.event_id, SUM(CASE WHEN x.status<>'normal' THEN 1 ELSE 0 END), COUNT(x.event_id) FROM event e "
                "LEFT JOIN (SELECT event_id, status FROM measurement UNION ALL SELECT event_id, status FROM daily_measurement) x "
                "ON x.event_id=e.event_id GROUP BY e.event_id")
    missed = [e for e, f, n in ev if not f]
    add("R14", "Cada anomalía inyectada genera al menos una alerta", not missed,
        ", ".join(f"{e}: {f}/{n}" for e, f, n in ev))

    # R15 confianza
    nv = q(con, "SELECT metric_code || ' (' || context || ')' FROM medical_reference WHERE confidence='needs_verification'")
    add("R15", "Umbrales verificados contra la fuente", not nv, f"pendientes: {', '.join(r[0] for r in nv)}" if nv else "todos", warn=True)
    return res


# ── gráficas ────────────────────────────────────────────────────────────────
def chart_radiation(con):
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.6))
    ax = axes[0]
    for m in ("SIM-LEO", "SIM-MOON", "SIM-MARS", "SIM-RETURN"):
        rows = q(con, "SELECT ts, value FROM measurement WHERE mission_code=? AND metric_code='radiation_dose_rate' ORDER BY ts", m)
        if rows:
            ax.plot(hours([r[0] for r in rows]), [r[1] for r in rows], lw=1, color=COLORS[m], label=m)
    ax.set_yscale("log")
    ax.set(title="Tasa de dosis, últimas 24 h (picos SAA en LEO, evento solar en Marte)", xlabel="horas", ylabel="mSv/día")
    ax.legend(fontsize=7)
    ax = axes[1]
    rows = q(con, "SELECT d.crew_code, d.value, d.mission_code FROM daily_measurement d JOIN mission m USING(mission_code) "
                  "WHERE d.metric_code='radiation_dose_career' AND d.mission_day=m.current_mission_day ORDER BY d.crew_code")
    ax.barh([r[0] for r in rows], [r[1] for r in rows], color=[COLORS[r[2]] for r in rows])
    ax.axvline(600, color=STATUS_COLORS["critical"], ls="--", lw=1, label="límite carrera 600 mSv")
    ax.axvline(480, color=STATUS_COLORS["warning"], ls=":", lw=1, label="80 %")
    ax.set(title="Dosis de carrera acumulada por tripulante", xlabel="mSv")
    ax.legend(fontsize=7)
    return fig_to_img(fig)


def chart_heart(con):
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.6))
    for ax, mission in zip(axes, ("SIM-LEO", "SIM-MARS")):
        bands(ax, con, "heart_rate")
        for (crew,) in q(con, "SELECT crew_code FROM crew_member WHERE mission_code=?", mission):
            rows = q(con, "SELECT ts, value, status FROM measurement WHERE crew_code=? AND metric_code='heart_rate' ORDER BY ts", crew)
            x = hours([r[0] for r in rows])
            ax.plot(x, [r[1] for r in rows], lw=0.8, label=crew)
            ax.scatter([x[i] for i, r in enumerate(rows) if r[2] == "critical"],
                       [r[1] for r in rows if r[2] == "critical"], color=STATUS_COLORS["critical"], s=10, zorder=3)
        ax.set(title=f"Frecuencia cardiaca {mission} (picos = ejercicio; rojo = crítico)", xlabel="horas", ylabel="lpm")
        ax.legend(fontsize=6, ncol=2)
    return fig_to_img(fig)


def daily_series(con, crew, metric):
    rows = q(con, "SELECT mission_day, value FROM daily_measurement WHERE crew_code=? AND metric_code=? ORDER BY mission_day", crew, metric)
    return [r[0] for r in rows], [r[1] for r in rows]


def chart_body(con):
    fig, axes = plt.subplots(2, 2, figsize=(11, 6.4))
    specs = [("muscle_strength_change_pct", "Fuerza muscular vs línea base (%)", "microgravity"),
             ("muscle_volume_change_pct", "Volumen muscular de pierna (%)", "microgravity"),
             ("urinary_calcium", "Calcio urinario (mg/24 h) — resorción ósea", "any"),
             ("bmd_change_pct_month", "Densidad mineral ósea (%/mes)", "microgravity")]
    for ax, (metric, title, ctx) in zip(axes.flat, specs):
        bands(ax, con, metric, ctx)
        for crew, mission in q(con, "SELECT crew_code, mission_code FROM crew_member"):
            x, y = daily_series(con, crew, metric)
            if x:
                style = dict(marker="o", ms=3) if metric == "bmd_change_pct_month" else {}
                hi = crew in ("CREW-LEO-04", "CREW-RETURN-01")
                ax.plot(x, y, lw=2 if hi else 0.7, alpha=1 if hi else 0.5,
                        color="#111111" if crew == "CREW-LEO-04" else COLORS[mission],
                        label=crew if hi else None, **style)
        ax.set(title=title, xlabel="día de misión")
        ax.legend(fontsize=7)
    fig.suptitle("Músculo y hueso — CREW-LEO-04 dejó de hacer ejercicio (EVT08); SIM-RETURN recupera", fontsize=10)
    return fig_to_img(fig)


def chart_gravity(con):
    fig, axes = plt.subplots(1, 3, figsize=(12, 3.6))
    for ax, (metric, title, ctx) in zip(axes, [("motion_sickness_score", "Mareo espacial (0-10)", "any"),
                                               ("sot_equilibrium_score", "Equilibrio SOT (oído interno)", "any"),
                                               ("hr_orthostatic_increase", "Aumento de FC al ponerse de pie (lpm)", "post_landing")]):
        bands(ax, con, metric, ctx)
        for mission in ("SIM-LEO", "SIM-MOON", "SIM-MARS", "SIM-RETURN"):
            rows = q(con, "SELECT mission_day, AVG(value) FROM daily_measurement WHERE mission_code=? AND metric_code=? "
                          "AND mission_day<=10 GROUP BY mission_day ORDER BY mission_day", mission, metric)
            if rows:
                ax.plot([r[0] for r in rows], [r[1] for r in rows], marker="o", ms=3, color=COLORS[mission], label=mission)
        ax.set(title=title, xlabel="días tras el cambio de gravedad")
        ax.legend(fontsize=7)
    fig.suptitle("Adaptación a nuevas gravedades: 0 g (LEO/Marte), 1/6 g (Luna) y regreso a 1 g", fontsize=10)
    return fig_to_img(fig)


def chart_stress(con):
    fig, axes = plt.subplots(1, 4, figsize=(13, 3.4))
    specs = [("hrv_rmssd", "HRV RMSSD (ms)"), ("urinary_cortisol", "Cortisol urinario (µg/24 h)"),
             ("pss10_score", "Estrés percibido PSS-10"), ("sleep_duration", "Sueño (h)")]
    for ax, (metric, title) in zip(axes, specs):
        bands(ax, con, metric)
        for crew, mission in q(con, "SELECT crew_code, mission_code FROM crew_member WHERE mission_code IN ('SIM-MARS','SIM-LEO')"):
            x, y = daily_series(con, crew, metric)
            cur = q(con, "SELECT current_mission_day FROM mission WHERE mission_code=?", mission)[0][0]
            pts = [(a - cur, b) for a, b in zip(x, y) if a > cur - 30]
            hi = crew in ("CREW-MARS-01", "CREW-LEO-01")
            ax.plot([p[0] for p in pts], [p[1] for p in pts], lw=1.6 if hi else 0.6, alpha=1 if hi else 0.45,
                    color=COLORS[mission], marker="o" if metric == "pss10_score" else None, ms=3,
                    label=crew if hi else None)
        ax.set(title=title, xlabel="días (0 = hoy)")
        ax.legend(fontsize=6)
    fig.suptitle("Estrés: CREW-MARS-01 aislamiento (EVT07) y CREW-LEO-01 caminatas espaciales (EVT12)", fontsize=10)
    return fig_to_img(fig)


def chart_environment(con):
    fig, axes = plt.subplots(1, 4, figsize=(13, 3.4))
    specs = [("cabin_co2", "CO2 cabina (mmHg)", None, "crew_cabin"), ("cabin_nh3", "Amoníaco (ppm)", None, "crew_cabin"),
             ("cabin_pressure", "Presión (kPa)", None, "crew_cabin"), ("spo2", "SpO2 (%) — CREW-MARS-03", "CREW-MARS-03", "any")]
    for ax, (metric, title, crew, ctx) in zip(axes, specs):
        bands(ax, con, metric, ctx)
        if crew:
            rows = q(con, "SELECT ts, value FROM measurement WHERE crew_code=? AND metric_code=? ORDER BY ts", crew, metric)
            ax.plot(hours([r[0] for r in rows]), [r[1] for r in rows], lw=0.9, color=COLORS["SIM-MARS"])
        else:
            for mission in ("SIM-LEO", "SIM-MOON", "SIM-MARS"):
                rows = q(con, "SELECT ts, value FROM measurement WHERE mission_code=? AND crew_code IS NULL AND metric_code=? ORDER BY ts", mission, metric)
                ax.plot(hours([r[0] for r in rows]), [r[1] for r in rows], lw=0.9, color=COLORS[mission], label=mission)
            ax.legend(fontsize=6)
        ax.set(title=title, xlabel="horas")
    fig.suptitle("Ambiente cerrado: falla de CO2 (EVT02), fuga de NH3 (EVT05), fuga de presión (EVT06), infección (EVT04)", fontsize=10)
    return fig_to_img(fig)


def chart_alerts(con):
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.4))
    ax = axes[0]
    data = {d: {s: 0 for s in ("warning", "critical")} for d in DOMAINS}
    for d, s, n in q(con, "SELECT m.domain_code, x.status, COUNT(*) FROM (SELECT metric_code, status FROM measurement UNION ALL "
                          "SELECT metric_code, status FROM daily_measurement) x JOIN metric m USING(metric_code) "
                          "WHERE x.status IN ('warning','critical') GROUP BY 1,2"):
        data[d][s] = n
    left = [0] * len(DOMAINS)
    for s in ("warning", "critical"):
        vals = [data[d][s] for d in DOMAINS]
        ax.barh(DOMAINS, vals, left=left, color=STATUS_COLORS[s], label=s)
        left = [a + b for a, b in zip(left, vals)]
    ax.set(title="Alertas por dominio de riesgo (24 h + historial)", xlabel="mediciones")
    ax.legend(fontsize=7)
    ax = axes[1]
    ev = q(con, "SELECT e.event_id, 100.0*SUM(CASE WHEN x.status<>'normal' THEN 1 ELSE 0 END)/COUNT(*) FROM event e JOIN "
                "(SELECT event_id, status FROM measurement UNION ALL SELECT event_id, status FROM daily_measurement) x "
                "ON x.event_id=e.event_id GROUP BY e.event_id ORDER BY e.event_id")
    ax.bar([r[0] for r in ev], [r[1] for r in ev], color="#2a6fdb")
    ax.set(title="% de puntos de cada evento marcados como alerta", ylabel="%", ylim=(0, 100))
    ax.tick_params(axis="x", rotation=60)
    return fig_to_img(fig)


# ── reporte ─────────────────────────────────────────────────────────────────
def table(rows, headers):
    th = "".join(f"<th>{html.escape(h)}</th>" for h in headers)
    body = "".join("<tr>" + "".join(f"<td class='{c if c in ('PASS', 'WARN', 'FAIL') else ''}'>{html.escape(str(c))}</td>"
                                    for c in r) + "</tr>" for r in rows)
    return f"<table><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>"


def build_report(con, reqs):
    counts = [(t, q(con, f"SELECT COUNT(*) FROM {t}")[0][0]) for (t,) in
              q(con, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    cover = q(con, "SELECT m.domain_code, COUNT(DISTINCT m.metric_code), COUNT(r.reference_id), "
                   "SUM(CASE WHEN r.confidence='high' THEN 1 ELSE 0 END), "
                   "(SELECT COUNT(*) FROM nasa_evidence_finding e WHERE e.domain_code=m.domain_code) "
                   "FROM metric m LEFT JOIN medical_reference r USING(metric_code) GROUP BY m.domain_code")
    events = q(con, "SELECT event_id, COALESCE(mission_code,'todas'), COALESCE(crew_code,'módulo/todos'), event_type, domain_code, description_es FROM event")
    sections = [
        ("Radiación", chart_radiation(con)), ("Corazón y palpitaciones", chart_heart(con)),
        ("Cuerpo: músculo y hueso", chart_body(con)), ("Oído interno y adaptación a la gravedad", chart_gravity(con)),
        ("Estrés", chart_stress(con)), ("Ambiente cerrado", chart_environment(con)), ("Alertas y detección", chart_alerts(con)),
    ]
    n_fail = sum(r[2] == "FAIL" for r in reqs)
    verdict = "Cumple todos los requisitos" if n_fail == 0 else f"{n_fail} requisito(s) sin cumplir"
    css = """
    :root{--bg:#fff;--fg:#1d2330;--mut:#5d6675;--line:#e3e6eb;--card:#f7f8fa}
    @media (prefers-color-scheme:dark){:root{--bg:#14171c;--fg:#e8eaee;--mut:#9aa3b2;--line:#2a2f37;--card:#1b1f26}}
    body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px 16px;max-width:1200px;margin:auto}
    h1{font-size:22px;margin:0 0 4px} h2{font-size:17px;margin:28px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
    .mut{color:var(--mut)} table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}
    th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
    th{background:var(--card)} td.PASS{color:#2e9e6a;font-weight:600} td.WARN{color:#c58f00;font-weight:600} td.FAIL{color:#d43c3c;font-weight:600}
    img{max-width:100%;background:#fff;border-radius:6px;border:1px solid var(--line)}
    .verdict{display:inline-block;padding:4px 10px;border-radius:6px;background:var(--card);font-weight:600}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
    """
    parts = [f"<!doctype html><html lang='es'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
             f"<title>Health Monitor DB</title><style>{css}</style></head><body>",
             "<h1>Health Monitor for Astronauts — base de datos</h1>",
             f"<p class='mut'>{DB.relative_to(DATA.parent)} · datos sintéticos calibrados con referencias clínicas y NASA LSDA · sin datos personales</p>",
             f"<p class='verdict'>{verdict}</p>",
             "<h2>Requisitos</h2>", table(reqs, ["ID", "Requisito", "Estado", "Detalle"]),
             "<h2>Cobertura por dominio de riesgo</h2>",
             table(cover, ["Dominio", "Métricas", "Rangos de referencia", "Confianza alta", "Hallazgos NASA"])]
    for title, img in sections:
        parts += [f"<h2>{title}</h2>", img]
    parts += ["<h2>Eventos inyectados (verdad de referencia)</h2>",
              table(events, ["Evento", "Misión", "Tripulante", "Tipo", "Dominio", "Descripción"]),
              "<h2>Tablas</h2><div class='grid'>", table(counts, ["Tabla", "Filas"]), "</div></body></html>"]
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
        print(f"{code:4} {name:{width}}  {st}")
        print(f"     └ {detail}")
    build_report(con, reqs)
    print(f"\nReporte: {REPORT}")
    if not a.no_open:
        webbrowser.open(REPORT.as_uri())
    sys.exit(1 if any(r[2] == "FAIL" for r in reqs) else 0)


if __name__ == "__main__":
    main()
