"""Genera datos sintéticos de tripulación y cabina calibrados con reference_data.py.

Alcance: temperatura (corporal y de cabina), presión (de cabina y arterial), cardiovascular,
saturación de oxígeno y radiación.
Sin datos personales: los tripulantes son códigos (CREW-LEO-01...), sin nombre ni edad.
Solo biblioteca estándar.  python data/scripts/generate_synthetic.py [--end 2026-11-14T12:00:00Z] [--seed 42]

Salidas (data/synthetic/, ignoradas por git; build_db.py las carga en la base):
  crew.csv                  tripulantes anónimos y su línea base
  measurements_24h.csv      últimas 24 h cada 5 min
  daily_measurements.csv    historial diario de la misión
  events.csv                eventos inyectados (verdad de referencia para evaluar detección)
"""
import argparse
import csv
import math
import random
import statistics
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import reference_data as R  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "synthetic"
STEP_MIN = 5
SLEEP_START_H, SLEEP_END_H = 22, 6          # horario de sueño en GMT (como en la ISS)
EXERCISE_BLOCKS = {0: (9, 10), 1: (11, 12), 2: (15, 16), 3: (17, 18)}  # por índice de tripulante
ROLES = ["Commander", "Flight Engineer", "Medical Officer", "Mission Specialist"]


# ── Referencia médica ───────────────────────────────────────────────────────
def load_reference():
    cols = R.REFERENCE_COLS[1:]
    refs = {(r[0], r[1]): dict(zip(cols, r)) for r in R.REFERENCES}
    missions = [dict(zip(R.MISSION_COLS, m)) for m in R.MISSIONS]
    return refs, missions


def pick_ref(refs, metric, mission, period=None):
    ctxs = [mission["environment_context"]] + (["earth"] if float(mission["gravity_g"]) >= 0.9 else [])
    ctxs += [period, "crew_cabin", "post_landing", "any"]
    for c in ctxs:
        if c and (metric, c) in refs:
            return refs[(metric, c)]
    return None


def status(ref, v):
    if ref is None:
        return "unknown"
    lo, hi = ref["critical_low"], ref["critical_high"]
    if (lo is not None and v <= lo) or (hi is not None and v >= hi):
        return "critical"
    nmin, nmax = ref["normal_min"], ref["normal_max"]
    if (nmin is not None and v < nmin) or (nmax is not None and v > nmax):
        return "warning"
    return "normal"


def expected(refs, metric, mission, default):
    r = pick_ref(refs, metric, mission)
    return default if r is None or r["expected_value"] is None else r["expected_value"]


# ── Eventos inyectados (verdad de referencia) ───────────────────────────────
def build_events(end):
    h = lambda hours_before: end - timedelta(hours=hours_before)
    return [
        dict(event_id="EVT01", mission_code="SIM-LEO", crew_code="CREW-LEO-02", event_type="tachycardia_episode",
             domain_code="GRAV", scale="24h", start=h(7), end=h(6.5), metrics="heart_rate",
             description_es="Episodio de palpitaciones/taquicardia en reposo (135-150 lpm) durante 30 min.",
             evidence_source_id="SRC_NEWS2"),
        dict(event_id="EVT02", mission_code="SIM-MARS", crew_code="", event_type="solar_particle_event",
             domain_code="RAD", scale="24h", start=h(10), end=h(4), metrics="radiation_dose_rate;dose_rate_spike_ratio",
             description_es="Evento de partículas solares: tasa de dosis hasta ~30x el fondo de crucero durante 6 h.",
             evidence_source_id="SRC_MSL_RAD"),
        dict(event_id="EVT03", mission_code="SIM-MARS", crew_code="CREW-MARS-03", event_type="respiratory_infection",
             domain_code="ENV", scale="24h", start=h(12), end=end, metrics="body_temp;spo2;heart_rate",
             description_es="Infección respiratoria: fiebre 38.6-39.3 °C, SpO2 91-93 % y FC +15 lpm.",
             evidence_source_id="SRC_NEWS2"),
        dict(event_id="EVT04", mission_code="SIM-MOON", crew_code="", event_type="slow_cabin_leak",
             domain_code="ENV", scale="24h", start=h(20), end=h(17), metrics="cabin_pressure",
             description_es="Fuga lenta: la presión cae de 101.3 a ~99.2 kPa en 3 h hasta que se sella.",
             evidence_source_id="SRC_PROJECT"),
        dict(event_id="EVT05", mission_code="SIM-LEO", crew_code="", event_type="thermal_control_failure",
             domain_code="ENV", scale="24h", start=h(16), end=h(11), metrics="cabin_temp",
             description_es="Falla del control térmico: la cabina sube de 22.5 a ~30.5 °C en 4 h y se restablece.",
             evidence_source_id="SRC_NASA_STD3001"),
        dict(event_id="EVT06", mission_code="SIM-MOON", crew_code="", event_type="partial_gravity_orthostatic",
             domain_code="GRAV", scale="daily", start=None, end=None, metrics="hr_orthostatic_increase;sbp_orthostatic_drop",
             description_es="Días 1-5 en la Luna: FC ortostática +30-36 lpm que se normaliza al adaptarse a 1/6 g.",
             evidence_source_id="LSDA_DSO603"),
        dict(event_id="EVT07", mission_code="SIM-RETURN", crew_code="", event_type="return_to_1g_readaptation",
             domain_code="GRAV", scale="daily", start=None, end=None, metrics="hr_orthostatic_increase;sbp_orthostatic_drop",
             description_es="Regreso a 1 g tras 6 meses: intolerancia ortostática que se recupera en ~1 semana (fenómeno esperado).",
             evidence_source_id="LSDA_DSO603"),
        dict(event_id="EVT08", mission_code="SIM-LEO", crew_code="CREW-LEO-03", event_type="rising_blood_pressure",
             domain_code="GRAV", scale="daily", start=None, end=None, metrics="systolic_bp;diastolic_bp",
             description_es="Últimos 10 días: la PA media diaria sube a 130-140 / 82-88 mmHg (hipertensión etapa 1-2).",
             evidence_source_id="SRC_AHA_BP"),
    ]


def active(events, mission, crew, metric, ts):
    for e in events:
        if e["scale"] != "24h" or e["mission_code"] != mission or metric not in e["metrics"].split(";"):
            continue
        if e["crew_code"] and e["crew_code"] != crew:
            continue
        if e["start"] <= ts <= e["end"]:
            return e
    return None


# ── Generación ──────────────────────────────────────────────────────────────
def is_asleep(ts):
    return ts.hour >= SLEEP_START_H or ts.hour < SLEEP_END_H


def activity_of(ts, idx):
    if is_asleep(ts):
        return "sleep"
    a, b = EXERCISE_BLOCKS[idx]
    return "exercise" if a <= ts.hour < b else "work"


def circ(ts, peak_hour=17):
    """Ritmo circadiano: +1 a la hora pico, -1 doce horas después."""
    return math.cos(2 * math.pi * ((ts.hour + ts.minute / 60) - peak_hour) / 24)


def gen_crew(rng, missions):
    crew = []
    for m in missions:
        tag = m["mission_code"].split("-")[1]
        for i in range(4):
            crew.append({
                "crew_code": f"CREW-{tag}-{i + 1:02d}", "mission_code": m["mission_code"], "role": ROLES[i],
                "crew_index": i,
                "baseline_hr": round(rng.uniform(58, 70)), "baseline_sbp": round(rng.uniform(112, 124)),
                "baseline_dbp": round(rng.uniform(69, 78)), "baseline_temp": round(rng.uniform(36.5, 36.9), 1),
                "prior_career_dose_msv": round(rng.uniform(0, 160), 1),
            })
    return crew


def frac(ts, e):
    return (ts - e["start"]) / (e["end"] - e["start"])


def gen_24h(rng, end, missions, crew, refs, events):
    rows = []
    start = end - timedelta(hours=24) + timedelta(minutes=STEP_MIN)
    times = [start + timedelta(minutes=STEP_MIN * k) for k in range(24 * 60 // STEP_MIN)]
    by_m = {m["mission_code"]: m for m in missions}

    def add(ts, m, crew_code, metric, value, act, period=None):
        ev = active(events, m["mission_code"], crew_code, metric, ts)
        rows.append({"ts": ts.strftime("%Y-%m-%dT%H:%M:%SZ"), "mission_code": m["mission_code"], "crew_code": crew_code,
                     "metric_code": metric, "value": value, "activity": act,
                     "status": status(pick_ref(refs, metric, m, period), value),
                     "is_injected_anomaly": int(ev is not None), "event_id": ev["event_id"] if ev else ""})

    # Cabina y radiación por misión (sensores del módulo)
    leak = next(e for e in events if e["event_id"] == "EVT04")
    for m in missions:
        mc = m["mission_code"]
        base_dose = expected(refs, "radiation_dose_rate", m, 0.5)
        if mc == "SIM-LEO":
            base_dose *= 0.78                 # fuera de la SAA; la SAA eleva el promedio diario al esperado
        series = []
        for ts in times:
            dose = base_dose * rng.gauss(1, 0.05)
            if mc == "SIM-LEO":
                orbit, phase = divmod((ts - times[0]).total_seconds() / 60, 92.7)
                if int(orbit) % 15 in range(4, 10) and phase < 12:   # ~6 pasos por la SAA al día
                    dose *= rng.uniform(4, 7)
            e = active(events, mc, "", "radiation_dose_rate", ts)
            if e:
                f = frac(ts, e)
                dose *= 1 + 29 * math.sin(math.pi * min(f * 1.6, 1)) ** 2 * (1.0 if f < 0.62 else 0.5)
            series.append((ts, round(dose, 4)))
        med = statistics.median(v for _, v in series)
        for ts, dose in series:
            act = "sleep" if is_asleep(ts) else "work"
            add(ts, m, "", "radiation_dose_rate", dose, act)
            add(ts, m, "", "dose_rate_spike_ratio", round(dose / med, 2), act)
            temp = 22.5 + 0.6 * circ(ts, 15) + rng.gauss(0, 0.15)
            e = active(events, mc, "", "cabin_temp", ts)
            if e:
                f = frac(ts, e)
                temp = (22.5 + 8 * f / 0.8 if f < 0.8 else 30.5 - 8 * (f - 0.8) / 0.2) + rng.gauss(0, 0.15)
            add(ts, m, "", "cabin_temp", round(temp, 2), act)
            p = 101.3 + rng.gauss(0, 0.05)
            e = active(events, mc, "", "cabin_pressure", ts)
            if e:
                p = 101.3 - 2.1 * frac(ts, e) + rng.gauss(0, 0.03)
            elif mc == "SIM-MOON" and ts > leak["end"]:
                p = 101.0 + rng.gauss(0, 0.05)    # repuesta tras sellar la fuga
            add(ts, m, "", "cabin_pressure", round(p, 2), act)

    # Signos vitales por tripulante
    for c in crew:
        m, i = by_m[c["mission_code"]], c["crew_index"]
        returning = m["environment_context"] == "post_landing"
        for ts in times:
            act = activity_of(ts, i)
            ex, sl = act == "exercise", act == "sleep"
            hr = (c["baseline_hr"] + (8 if returning and act == "work" else 0) + 4 * circ(ts) - (7 if sl else 0)
                  + (rng.uniform(40, 55) if ex else 0) + rng.gauss(0, 2.5))
            sbp = c["baseline_sbp"] + 4 * circ(ts) - (6 if sl else 0) + (22 if ex else 0) + rng.gauss(0, 3)
            dbp = c["baseline_dbp"] + 2 * circ(ts) - (3 if sl else 0) + (4 if ex else 0) + rng.gauss(0, 2)
            temp = c["baseline_temp"] + 0.3 * circ(ts) + (0.3 if ex else 0) + rng.gauss(0, 0.05)
            spo2 = min(100, rng.gauss(97.8, 0.5) - (0.6 if ex else 0))
            e = active(events, m["mission_code"], c["crew_code"], "heart_rate", ts)
            if e and e["event_type"] == "tachycardia_episode":
                hr = rng.uniform(135, 150)
            inf = active(events, m["mission_code"], c["crew_code"], "body_temp", ts)
            if inf:
                ramp = min(1, (ts - inf["start"]).total_seconds() / 10800)
                temp = 37.0 + ramp * rng.uniform(1.6, 2.3)
                spo2 = 97.5 - ramp * rng.uniform(4.5, 6.5)
                hr += 15 * ramp
            period = "exercise" if ex else None
            for metric, v, nd in (("heart_rate", hr, 0), ("systolic_bp", sbp, 0), ("diastolic_bp", dbp, 0),
                                  ("body_temp", temp, 2), ("spo2", spo2, 1)):
                add(ts, m, c["crew_code"], metric, round(v, nd) if nd else int(round(v)), act, period)
    return rows


def gen_daily(rng, end, missions, crew, refs):
    rows = []
    by_m = {m["mission_code"]: m for m in missions}

    def add(day_date, mday, m, crew_code, metric, value, event_id="", period=None):
        rows.append({"date": day_date.isoformat(), "mission_day": mday, "mission_code": m["mission_code"],
                     "crew_code": crew_code, "metric_code": metric, "value": value,
                     "status": status(pick_ref(refs, metric, m, period), value),
                     "is_injected_anomaly": int(bool(event_id)), "event_id": event_id})

    for c in crew:
        m, cc = by_m[c["mission_code"]], c["crew_code"]
        cur = int(m["current_mission_day"])
        returning = m["environment_context"] == "post_landing"
        partial_g = 0 < float(m["gravity_g"]) < 0.5
        dose_day = expected(refs, "radiation_dose_rate", m, 0.5)
        career0 = c["prior_career_dose_msv"] + (180 * 0.5 if returning else 0)   # 180 días previos en LEO
        doses = []
        for d in range(1, cur + 1):
            date = (end - timedelta(days=cur - d)).date()
            # Presión arterial media diaria (tendencia)
            bp = "EVT08" if cc == "CREW-LEO-03" and cur - d < 10 else ""
            rise = (10 - (cur - d)) / 10 if bp else 0
            add(date, d, m, cc, "systolic_bp", round(c["baseline_sbp"] + rng.gauss(0, 2) + 20 * rise), bp, "daily_mean")
            add(date, d, m, cc, "diastolic_bp", round(c["baseline_dbp"] + rng.gauss(0, 1.5) + 12 * rise), bp)
            # Adaptación cardiovascular a la gravedad (prueba ortostática)
            if returning:
                add(date, d, m, cc, "hr_orthostatic_increase", round(rng.uniform(36, 44) * math.exp(-(d - 1) / 5)), "EVT07")
                add(date, d, m, cc, "sbp_orthostatic_drop", round(rng.uniform(22, 30) * math.exp(-(d - 1) / 4)), "EVT07")
            elif partial_g and d <= 10:              # llegada a gravedad lunar tras el tránsito
                ev = "EVT06" if d <= 5 else ""
                hr_inc = rng.uniform(30, 36) - 4 * (d - 1) if d <= 5 else rng.uniform(8, 15)
                add(date, d, m, cc, "hr_orthostatic_increase", round(hr_inc), ev)
                add(date, d, m, cc, "sbp_orthostatic_drop", round(rng.uniform(14, 20) * math.exp(-(d - 1) / 3)), ev)
            # Radiación acumulada por tripulante
            dd = dose_day * rng.gauss(1, 0.05)
            if m["mission_code"] == "SIM-MARS" and d == cur:
                dd *= 8                              # día del evento solar (EVT02)
            doses.append(dd)
            add(date, d, m, cc, "radiation_dose_30d", round(sum(doses[-30:]), 2))
            add(date, d, m, cc, "radiation_dose_365d", round(sum(doses[-365:]) + (90 if returning else 0), 2))
            add(date, d, m, cc, "radiation_dose_career", round(career0 + sum(doses), 2))
    return rows


def write(path, rows, cols):
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main(end, seed):
    rng = random.Random(seed)
    refs, missions = load_reference()
    OUT.mkdir(exist_ok=True)
    events = build_events(end)
    crew = gen_crew(rng, missions)
    m24 = gen_24h(rng, end, missions, crew, refs, events)
    daily = gen_daily(rng, end, missions, crew, refs)
    for i, r in enumerate(m24, 1):
        r["measurement_id"] = i
    for i, r in enumerate(daily, 1):
        r["daily_id"] = i
    for e in events:
        for k in ("start", "end"):
            e[f"{k}_ts"] = e[k].strftime("%Y-%m-%dT%H:%M:%SZ") if e[k] else ""

    write(OUT / "crew.csv", crew, ["crew_code", "mission_code", "role", "baseline_hr", "baseline_sbp", "baseline_dbp",
                                   "baseline_temp", "prior_career_dose_msv"])
    write(OUT / "measurements_24h.csv", m24, ["measurement_id", "ts", "mission_code", "crew_code", "metric_code", "value",
                                              "activity", "status", "is_injected_anomaly", "event_id"])
    write(OUT / "daily_measurements.csv", daily, ["daily_id", "date", "mission_day", "mission_code", "crew_code",
                                                  "metric_code", "value", "status", "is_injected_anomaly", "event_id"])
    write(OUT / "events.csv", events, ["event_id", "mission_code", "crew_code", "event_type", "domain_code", "scale",
                                       "start_ts", "end_ts", "metrics", "description_es", "evidence_source_id"])
    print(f"crew={len(crew)} measurements_24h={len(m24)} daily={len(daily)} events={len(events)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--end", default="2026-11-14T12:00:00Z", help="fin de la ventana de 24 h (UTC)")
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    main(datetime.strptime(a.end, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc), a.seed)
