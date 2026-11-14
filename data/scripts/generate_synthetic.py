"""Genera datos sintéticos de tripulación y cabina calibrados con data/reference/.

Sin datos personales: los tripulantes son códigos (CREW-LEO-01...), sin nombre ni edad.
Solo biblioteca estándar.  python data/scripts/generate_synthetic.py [--end 2026-11-14T12:00:00Z] [--seed 42]

Salidas (data/synthetic/):
  crew.csv                  tripulantes anónimos y su línea base
  measurements_24h.csv      últimas 24 h cada 5 min (signos vitales + ambiente + radiación)
  daily_measurements.csv    historial diario/semanal/mensual de toda la misión
  events.csv                eventos inyectados (verdad de referencia para evaluar detección)
"""
import argparse
import csv
import math
import random
import statistics
from datetime import datetime, timedelta, timezone
from pathlib import Path

DATA = Path(__file__).resolve().parents[1]
REF, OUT = DATA / "reference", DATA / "synthetic"
STEP_MIN = 5
SLEEP_START_H, SLEEP_END_H = 22, 6          # horario de sueño en GMT (como en la ISS)
EXERCISE_BLOCKS = {0: (9, 10), 1: (11, 12), 2: (15, 16), 3: (17, 18)}  # por índice de tripulante
ROLES = ["Commander", "Flight Engineer", "Medical Officer", "Mission Specialist"]


# ── Referencia médica ───────────────────────────────────────────────────────
def load_reference():
    refs = {}
    for r in csv.DictReader((REF / "medical_reference.csv").open(encoding="utf-8")):
        refs[(r["metric_code"], r["context"])] = {k: (float(v) if v not in ("", None) and k in (
            "normal_min", "normal_max", "critical_low", "critical_high", "expected_value") else v) for k, v in r.items()}
    missions = list(csv.DictReader((REF / "missions.csv").open(encoding="utf-8")))
    return refs, missions


def pick_ref(refs, metric, mission, period=None):
    ctxs = [mission["environment_context"]] + (["earth"] if float(mission["gravity_g"]) >= 0.9 else [])
    if float(mission["gravity_g"]) < 0.5:
        ctxs.append("microgravity")           # gravedad parcial lunar se trata como gravedad reducida
    ctxs += [period, "crew_cabin", "post_landing", "any"]
    for c in ctxs:
        if c and (metric, c) in refs:
            return refs[(metric, c)]
    return None


def status(ref, v):
    if ref is None:
        return "unknown"
    lo, hi = ref["critical_low"], ref["critical_high"]
    if (lo not in ("", None) and v <= lo) or (hi not in ("", None) and v >= hi):
        return "critical"
    nmin, nmax = ref["normal_min"], ref["normal_max"]
    if (nmin not in ("", None) and v < nmin) or (nmax not in ("", None) and v > nmax):
        return "warning"
    return "normal"


def expected(refs, metric, mission, default):
    r = pick_ref(refs, metric, mission)
    v = r["expected_value"] if r else ""
    return default if v in ("", None) else v


# ── Eventos inyectados (verdad de referencia) ───────────────────────────────
def build_events(end):
    h = lambda hours_before: end - timedelta(hours=hours_before)
    return [
        dict(event_id="EVT01", mission_code="SIM-LEO", crew_code="CREW-LEO-02", event_type="tachycardia_episode",
             domain_code="GRAV", scale="24h", start=h(7), end=h(6.5), metrics="heart_rate",
             description_es="Episodio de palpitaciones/taquicardia en reposo (135-150 lpm) durante 30 min.",
             evidence_source_id="SRC_NEWS2"),
        dict(event_id="EVT02", mission_code="SIM-LEO", crew_code="", event_type="co2_scrubber_degradation",
             domain_code="ENV", scale="24h", start=h(14), end=h(8), metrics="cabin_co2;resp_rate",
             description_es="Degradación del removedor de CO2: sube de ~2.3 a ~4.6 mmHg en 6 h; FR de la tripulación +2.",
             evidence_source_id="LSDA_LMLSTP"),
        dict(event_id="EVT03", mission_code="SIM-MARS", crew_code="", event_type="solar_particle_event",
             domain_code="RAD", scale="24h", start=h(10), end=h(4), metrics="radiation_dose_rate;dose_rate_spike_ratio",
             description_es="Evento de partículas solares: tasa de dosis hasta ~30x el fondo de crucero durante 6 h.",
             evidence_source_id="SRC_MSL_RAD"),
        dict(event_id="EVT04", mission_code="SIM-MARS", crew_code="CREW-MARS-03", event_type="respiratory_infection",
             domain_code="ENV", scale="24h", start=h(12), end=end, metrics="body_temp;spo2;resp_rate;heart_rate",
             description_es="Infección respiratoria: fiebre 38.6-39.3 °C, SpO2 91-93 %, FR 22-26, FC +15.",
             evidence_source_id="SRC_NEWS2"),
        dict(event_id="EVT05", mission_code="SIM-MOON", crew_code="", event_type="ammonia_leak",
             domain_code="ENV", scale="24h", start=h(5), end=h(4.25), metrics="cabin_nh3",
             description_es="Fuga de refrigerante: NH3 hasta ~38 ppm durante 45 min, luego depuración.",
             evidence_source_id="LSDA_MIR_AIR"),
        dict(event_id="EVT06", mission_code="SIM-MOON", crew_code="", event_type="slow_cabin_leak",
             domain_code="ENV", scale="24h", start=h(20), end=h(17), metrics="cabin_pressure",
             description_es="Fuga lenta: presión cae de 101.3 a ~99.2 kPa en 3 h hasta que se sella.",
             evidence_source_id="SRC_PROJECT"),
        dict(event_id="EVT07", mission_code="SIM-MARS", crew_code="CREW-MARS-01", event_type="isolation_sleep_mood",
             domain_code="ISO", scale="daily", start=None, end=None, metrics="sleep_duration;pvt_mean_rt;pvt_lapses;phq9_score;gad7_score;pss10_score;hrv_rmssd;urinary_cortisol",
             description_es="Últimos 14 días: sueño 4.5-5.5 h, PVT más lento, PHQ-9 y estrés percibido en ascenso, HRV en caída y cortisol alto (aislamiento, fenómeno de tercer cuarto).",
             evidence_source_id="LSDA_9401628"),
        dict(event_id="EVT08", mission_code="SIM-LEO", crew_code="CREW-LEO-04", event_type="missed_countermeasures",
             domain_code="GRAV", scale="daily", start=None, end=None, metrics="exercise_minutes;bmd_change_pct_month;muscle_strength_change_pct;muscle_volume_change_pct;urinary_calcium",
             description_es="Últimas 4 semanas con ~40 min/día de ejercicio: pérdida ósea acelerada, fuerza en caída y calcio urinario >300 mg/d.",
             evidence_source_id="LSDA_DSO477"),
        dict(event_id="EVT09", mission_code="SIM-MARS", crew_code="CREW-MARS-04", event_type="weight_loss",
             domain_code="DIST", scale="daily", start=None, end=None, metrics="body_mass_change_pct_month",
             description_es="Ingesta insuficiente: -5.5 % de masa corporal en el último mes.",
             evidence_source_id="SRC_ASPEN_MALN"),
        dict(event_id="EVT10", mission_code="", crew_code="", event_type="space_motion_sickness",
             domain_code="GRAV", scale="daily", start=None, end=None, metrics="motion_sickness_score",
             description_es="(Todas las misiones) Días 1-3: ~2/3 de la tripulación con mareo espacial (fenómeno esperado).",
             evidence_source_id="SRC_SMS"),
        dict(event_id="EVT11", mission_code="SIM-MOON", crew_code="", event_type="partial_gravity_orthostatic",
             domain_code="GRAV", scale="daily", start=None, end=None, metrics="hr_orthostatic_increase;sot_equilibrium_score",
             description_es="Días 1-5 en la Luna: FC ortostática +30-36 lpm y equilibrio (SOT) bajo que se normalizan al adaptarse a 1/6 g.",
             evidence_source_id="LSDA_DSO603"),
        dict(event_id="EVT12", mission_code="SIM-LEO", crew_code="CREW-LEO-01", event_type="eva_workload_stress",
             domain_code="ISO", scale="daily", start=None, end=None, metrics="urinary_cortisol;hrv_rmssd;pss10_score;gad7_score",
             description_es="Últimos 5 días con caminatas espaciales (EVA) y alta carga: cortisol 55-75 µg/24 h, HRV -65 %, PSS-10 alto.",
             evidence_source_id="LSDA_CORTISOL"),
        dict(event_id="EVT13", mission_code="SIM-RETURN", crew_code="", event_type="return_to_1g_readaptation",
             domain_code="GRAV", scale="daily", start=None, end=None,
             metrics="hr_orthostatic_increase;sbp_orthostatic_drop;sot_equilibrium_score;motion_sickness_score",
             description_es="Regreso a 1 g tras 6 meses: intolerancia ortostática, equilibrio bajo y mareo que se recuperan en ~1 semana (fenómeno esperado).",
             evidence_source_id="LSDA_BALANCE"),
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


def gen_crew(rng, missions, refs):
    crew = []
    for m in missions:
        tag = m["mission_code"].split("-")[1]
        for i in range(4):
            crew.append({
                "crew_code": f"CREW-{tag}-{i + 1:02d}", "mission_code": m["mission_code"], "role": ROLES[i],
                "crew_index": i,
                "baseline_hr": round(rng.uniform(58, 70)), "baseline_sbp": round(rng.uniform(112, 124)),
                "baseline_dbp": round(rng.uniform(69, 78)), "baseline_temp": round(rng.uniform(36.5, 36.9), 1),
                "baseline_resp": round(rng.uniform(14, 16)),
                "prior_career_dose_msv": round(rng.uniform(0, 160), 1),
            })
    return crew


def gen_24h(rng, end, missions, crew, refs, events):
    rows = []
    start = end - timedelta(hours=24) + timedelta(minutes=STEP_MIN)
    times = [start + timedelta(minutes=STEP_MIN * k) for k in range(24 * 60 // STEP_MIN)]
    by_m = {m["mission_code"]: m for m in missions}

    def add(ts, m, crew_code, metric, value, act, period=None):
        ref = pick_ref(refs, metric, m, period)
        ev = active(events, m["mission_code"], crew_code, metric, ts)
        rows.append({"ts": ts.strftime("%Y-%m-%dT%H:%M:%SZ"), "mission_code": m["mission_code"], "crew_code": crew_code,
                     "metric_code": metric, "value": value, "activity": act, "status": status(ref, value),
                     "is_injected_anomaly": int(ev is not None), "event_id": ev["event_id"] if ev else ""})

    # Ambiente y radiación por misión (módulo principal)
    for m in missions:
        mc = m["mission_code"]
        base_dose = expected(refs, "radiation_dose_rate", m, 0.5)
        if mc == "SIM-LEO":
            base_dose *= 0.78                 # fuera de la SAA; la SAA eleva el promedio diario al esperado
        series = []
        for ts in times:
            sleep = is_asleep(ts)
            # radiación
            dose = base_dose * rng.gauss(1, 0.05)
            if mc == "SIM-LEO":
                minutes = (ts - times[0]).total_seconds() / 60
                orbit, phase = divmod(minutes, 92.7)
                if int(orbit) % 15 in range(4, 10) and phase < 12:   # ~6 pasos por la SAA al día
                    dose *= rng.uniform(4, 7)
            e = active(events, mc, "", "radiation_dose_rate", ts)
            if e:
                frac = (ts - e["start"]) / (e["end"] - e["start"])
                dose *= 1 + 29 * math.sin(math.pi * min(frac * 1.6, 1)) ** 2 * (1.0 if frac < 0.62 else 0.5)
            series.append((ts, round(dose, 4)))
        med = statistics.median(v for _, v in series)
        for ts, dose in series:
            act = "sleep" if is_asleep(ts) else "work"
            add(ts, m, "", "radiation_dose_rate", dose, act)
            add(ts, m, "", "dose_rate_spike_ratio", round(dose / med, 2), act)
            add(ts, m, "", "comm_delay_one_way", round(float(m["comm_delay_one_way_s"]) * rng.uniform(0.98, 1.02), 2), act)

            sleep = is_asleep(ts)
            co2 = expected(refs, "cabin_co2", m, 2.2) + (0 if sleep else 0.12) + rng.gauss(0, 0.06)
            e = active(events, mc, "", "cabin_co2", ts)
            if e:
                co2 = 2.3 + 2.3 * (ts - e["start"]) / (e["end"] - e["start"]) + rng.gauss(0, 0.05)
            add(ts, m, "", "cabin_co2", round(co2, 2), act)
            add(ts, m, "", "cabin_o2", round(21.0 + rng.gauss(0, 0.15), 2), act)
            add(ts, m, "", "cabin_temp", round(22.5 + 0.6 * circ(ts, 15) + rng.gauss(0, 0.15), 2), act)
            add(ts, m, "", "cabin_rh", round(45 + 3 * circ(ts, 9) + (0 if sleep else 2) + rng.gauss(0, 1), 1), act)
            p = 101.3 + rng.gauss(0, 0.05)
            e = active(events, mc, "", "cabin_pressure", ts)
            if e:
                p = 101.3 - 2.1 * (ts - e["start"]) / (e["end"] - e["start"]) + rng.gauss(0, 0.03)
            elif mc == "SIM-MOON" and ts > [x for x in events if x["event_id"] == "EVT06"][0]["end"]:
                p = 101.0 + rng.gauss(0, 0.05)    # repuesta tras sellar la fuga
            add(ts, m, "", "cabin_pressure", round(p, 2), act)
            add(ts, m, "", "cabin_co", round(max(0, 1 + rng.gauss(0, 0.3)), 2), act)
            nh3 = max(0, 0.3 + rng.gauss(0, 0.08))
            e = active(events, mc, "", "cabin_nh3", ts)
            if e:
                frac = (ts - e["start"]) / (e["end"] - e["start"])
                nh3 = 38 * math.sin(math.pi * frac) + rng.gauss(0, 1)
            add(ts, m, "", "cabin_nh3", round(max(0, nh3), 2), act)
            add(ts, m, "", "noise_level", round((52 if sleep else 56) + rng.gauss(0, 1.5), 1), act)
            lux = max(0, rng.gauss(1, 0.5)) if sleep else rng.gauss(500, 40)
            add(ts, m, "", "illumination", round(lux, 1), act, "sleep_period" if sleep else "work_period")

    # Signos vitales por tripulante
    for c in crew:
        m, i = by_m[c["mission_code"]], c["crew_index"]
        for ts in times:
            act = activity_of(ts, i)
            ex, sl = act == "exercise", act == "sleep"
            hr = c["baseline_hr"] + (8 if m["environment_context"] == "post_landing" and act == "work" else 0) + 4 * circ(ts) - (7 if sl else 0) + (rng.uniform(40, 55) if ex else 0) + rng.gauss(0, 2.5)
            sbp = c["baseline_sbp"] + 4 * circ(ts) - (6 if sl else 0) + (22 if ex else 0) + rng.gauss(0, 3)
            dbp = c["baseline_dbp"] + 2 * circ(ts) - (3 if sl else 0) + (4 if ex else 0) + rng.gauss(0, 2)
            temp = c["baseline_temp"] + 0.3 * circ(ts) + (0.3 if ex else 0) + rng.gauss(0, 0.05)
            rr = c["baseline_resp"] - (1 if sl else 0) + (8 if ex else 0) + rng.gauss(0, 0.8)
            spo2 = min(100, rng.gauss(97.8, 0.5) - (0.6 if ex else 0))
            co2_ev = active(events, m["mission_code"], "", "cabin_co2", ts)
            if co2_ev:
                rr += 2 * (ts - co2_ev["start"]) / (co2_ev["end"] - co2_ev["start"])
            e = active(events, m["mission_code"], c["crew_code"], "heart_rate", ts)
            if e and e["event_type"] == "tachycardia_episode":
                hr = rng.uniform(135, 150)
            inf = active(events, m["mission_code"], c["crew_code"], "body_temp", ts)
            if inf:
                ramp = min(1, (ts - inf["start"]).total_seconds() / 10800)
                temp = 37.0 + ramp * rng.uniform(1.6, 2.3)
                spo2 = 97.5 - ramp * rng.uniform(4.5, 6.5)
                rr = c["baseline_resp"] + ramp * rng.uniform(8, 11)
                hr += 15 * ramp
            for metric, v, nd in (("heart_rate", hr, 0), ("systolic_bp", sbp, 0), ("diastolic_bp", dbp, 0),
                                  ("body_temp", temp, 2), ("resp_rate", rr, 0), ("spo2", spo2, 1)):
                add(ts, m, c["crew_code"], metric, round(v, nd) if nd else int(round(v)), act,
                    "exercise" if ex else None)
    return rows


def gen_daily(rng, end, missions, crew, refs):
    rows = []
    by_m = {m["mission_code"]: m for m in missions}

    def add(day_date, mday, m, crew_code, metric, value, event_id=""):
        ref = pick_ref(refs, metric, m)
        rows.append({"date": day_date.isoformat(), "mission_day": mday, "mission_code": m["mission_code"],
                     "crew_code": crew_code, "metric_code": metric, "value": value, "status": status(ref, value),
                     "is_injected_anomaly": int(bool(event_id)), "event_id": event_id})

    for c in crew:
        m = by_m[c["mission_code"]]
        cc = c["crew_code"]
        cur = int(m["current_mission_day"])
        returning = m["environment_context"] == "post_landing"
        partial_g = 0 < float(m["gravity_g"]) < 0.5
        dose_day = expected(refs, "radiation_dose_rate", m, 0.5)
        if returning:                               # 180 días previos en órbita baja
            career0 = c["prior_career_dose_msv"] + 180 * 0.5
            strength, volume = rng.uniform(-11, -8), rng.uniform(-9, -6)
        else:
            career0, strength, volume = c["prior_career_dose_msv"], 0.0, 0.0
        doses = []
        hrv_base = rng.uniform(38, 55)
        ev_iso, ev_ex = cc == "CREW-MARS-01", cc == "CREW-LEO-04"
        ev_wt, ev_eva = cc == "CREW-MARS-04", cc == "CREW-LEO-01"
        sms_prone = rng.random() < 0.67
        for d in range(1, cur + 1):
            date = (end - timedelta(days=cur - d)).date()
            late, late4w, last5 = cur - d < 14, cur - d < 28, cur - d < 5
            weekly = (d % 3 == 1 if returning else d % 7 == 0) or d == cur   # rehabilitación: cada 3 días

            # ── Aislamiento: sueño, desempeño, ánimo ──
            iso = "EVT07" if ev_iso and late else ""
            sleep = rng.uniform(4.5, 5.5) if iso else rng.gauss(7.2 if returning else 6.0, 0.5)
            add(date, d, m, cc, "sleep_duration", round(sleep, 2), iso)
            add(date, d, m, cc, "sleep_efficiency", round(min(99, rng.gauss(89, 2.5) - (6 if iso else 0)), 1), iso)
            add(date, d, m, cc, "sleep_latency", round(max(2, rng.gauss(20, 7) + (15 if iso else 0))), iso)
            add(date, d, m, cc, "pvt_mean_rt", round(rng.uniform(320, 380) if iso else rng.gauss(260, 15)), iso)
            add(date, d, m, cc, "pvt_lapses", max(0, round(rng.gauss(1, 0.8) + (4 if iso else 0))), iso)

            # ── Estrés: fisiológico (HRV, cortisol) y percibido (PSS-10) ──
            eva = "EVT12" if ev_eva and last5 else ""
            stress_ev = iso or eva
            ramp = (14 - (cur - d)) / 14 if iso else 1
            hrv = hrv_base * (1 - (0.65 * ramp if iso else 0.65 if eva else 0)) + rng.gauss(0, 3)
            cort = rng.gauss(28, 6) + (25 * ramp if iso else rng.uniform(25, 45) if eva else 0)
            add(date, d, m, cc, "hrv_rmssd", round(max(5, hrv), 1), stress_ev)
            add(date, d, m, cc, "urinary_cortisol", round(cort, 1), stress_ev)
            if weekly:
                add(date, d, m, cc, "pss10_score", min(40, rng.randint(6, 12) + (int(12 * ramp) if iso else 11 if eva else 0)), stress_ev)
                add(date, d, m, cc, "phq9_score", min(27, rng.randint(1, 4) + (int(9 * ramp) if iso else 0)), iso)
                add(date, d, m, cc, "gad7_score", rng.randint(1, 4) + (6 if iso else 3 if eva else 0), stress_ev)

            # ── Gravedad: músculo, hueso, riñón ──
            exm = "EVT08" if ev_ex and late4w else ""
            ex = rng.gauss(40, 10) if exm else rng.gauss(60 if returning else 138, 9)
            add(date, d, m, cc, "exercise_minutes", round(ex), exm)
            if returning:
                ca = 180 + 60 * math.exp(-d / 4) + rng.gauss(0, 15)
                strength += 0.45
                volume += 0.3
            else:
                ca = 180 + 45 * (1 - math.exp(-d / 10)) + rng.gauss(0, 18) + (85 if exm else 0)
                rate = 0.022 if partial_g else 0.045
                strength -= rate * (5 if exm else 1)
                volume -= rate * 1.1 * (3 if exm else 1)
            add(date, d, m, cc, "urinary_calcium", round(ca), exm)
            if weekly:
                add(date, d, m, cc, "muscle_strength_change_pct", round(strength + rng.gauss(0, 1), 1), exm)
                add(date, d, m, cc, "muscle_volume_change_pct", round(volume + rng.gauss(0, 0.7), 1), exm)
            if d % 30 == 0 and not returning:
                bmd = rng.gauss(-0.4, 0.2) * (0.6 if partial_g else 1) + (-1.5 if exm else 0)
                add(date, d, m, cc, "bmd_change_pct_month", round(bmd, 2), exm)
                wt = rng.gauss(-0.8, 0.6) + (-4.7 if ev_wt and late4w else 0)
                add(date, d, m, cc, "body_mass_change_pct_month", round(wt, 2), "EVT09" if ev_wt and late4w else "")

            # ── Oído interno y adaptación a la gravedad ──
            if returning:
                ev = "EVT13"
                add(date, d, m, cc, "hr_orthostatic_increase", round(rng.uniform(36, 44) * math.exp(-(d - 1) / 5)), ev)
                add(date, d, m, cc, "sbp_orthostatic_drop", round(rng.uniform(22, 30) * math.exp(-(d - 1) / 4)), ev)
                add(date, d, m, cc, "sot_equilibrium_score", round(min(95, 45 + 32 * (1 - math.exp(-(d - 1) / 3)) + rng.gauss(0, 3))), ev)
                sms = rng.uniform(4, 7) * math.exp(-(d - 1) / 1.2) if sms_prone else rng.uniform(0, 1.5)
                add(date, d, m, cc, "motion_sickness_score", round(sms, 1), ev if sms_prone else "")
            else:
                if d <= 3:
                    sms = rng.uniform(3.5, 7.5) * (1 - 0.3 * (d - 1)) if sms_prone else rng.uniform(0, 2)
                    add(date, d, m, cc, "motion_sickness_score", round(sms, 1), "EVT10" if sms_prone else "")
                else:
                    add(date, d, m, cc, "motion_sickness_score", round(rng.uniform(0, 1.2), 1))
                if partial_g and d <= 10:          # llegada a gravedad lunar tras el tránsito
                    add(date, d, m, cc, "hr_orthostatic_increase", round(rng.uniform(30, 36) - 4 * (d - 1)) if d <= 5 else round(rng.uniform(8, 15)), "EVT11" if d <= 5 else "")
                    add(date, d, m, cc, "sot_equilibrium_score", round(min(95, 58 + 25 * (1 - math.exp(-(d - 1) / 2.5)) + rng.gauss(0, 3))), "EVT11" if d <= 5 else "")

            # ── Radiación (dosis acumulada por tripulante) ──
            dd = dose_day * rng.gauss(1, 0.05)
            if m["mission_code"] == "SIM-MARS" and d == cur:
                dd *= 8                             # día del evento solar (EVT03)
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
    crew = gen_crew(rng, missions, refs)
    m24 = gen_24h(rng, end, missions, crew, refs, events)
    daily = gen_daily(rng, end, missions, crew, refs)

    write(OUT / "crew.csv", crew, ["crew_code", "mission_code", "role", "baseline_hr", "baseline_sbp", "baseline_dbp",
                                   "baseline_temp", "baseline_resp", "prior_career_dose_msv"])
    for i, r in enumerate(m24, 1):
        r["measurement_id"] = i
    for i, r in enumerate(daily, 1):
        r["daily_id"] = i
    write(OUT / "measurements_24h.csv", m24, ["measurement_id", "ts", "mission_code", "crew_code", "metric_code", "value", "activity",
                                              "status", "is_injected_anomaly", "event_id"])
    write(OUT / "daily_measurements.csv", daily, ["daily_id", "date", "mission_day", "mission_code", "crew_code", "metric_code",
                                                  "value", "status", "is_injected_anomaly", "event_id"])
    for e in events:
        for k in ("start", "end"):
            e[f"{k}_ts"] = e[k].strftime("%Y-%m-%dT%H:%M:%SZ") if e[k] else ""
    write(OUT / "events.csv", events, ["event_id", "mission_code", "crew_code", "event_type", "domain_code", "scale",
                                       "start_ts", "end_ts", "metrics", "description_es", "evidence_source_id"])
    print(f"crew={len(crew)} measurements_24h={len(m24)} daily={len(daily)} events={len(events)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--end", default="2026-11-14T12:00:00Z", help="fin de la ventana de 24 h (UTC)")
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    main(datetime.strptime(a.end, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc), a.seed)
