# ORBIT CARE — Astronaut Health Monitor (frontend)

NASA Space Apps 2026 · "Create Health Monitoring Software for Astronauts on Space Missions".
Diseño: fusión de la propuesta **2 (Dark/Tech)** + **3 (Glass/Modern)** — Orbitron + Plus Jakarta Sans.

## Correr
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # versión estática en dist/
```
100% offline: sin APIs, fuentes empaquetadas localmente, check-ins guardados en el navegador.

## Datos (fuente principal)
Estudio **BRSMCF CFT70** — 70 días de reposo en cama con inclinación cabeza abajo (análogo de microgravedad), 37 sujetos, 4 grupos (Control, Exercise A, Exercise B, Flywheel).
`src/data/echo/` (copia en `~/Desktop/hack/data/`):
- `echo_all.csv` — eco 2D/Doppler/TDI, 5 tiempos (Pre, D7, D70, R+0, R+3)
- `echo_3d.csv` — eco 3D: masa VI, LVEDV, LVESV (promedio de 2 analistas), incluye D21 y D30
- `echo_7_subjects.csv` — subconjunto de 7 sujetos = "tripulación"

Derivadas: SV = EDV−ESV, EF, gasto cardíaco = SV×FC, FS, E/A, E/e′, índice Tei, RVSP = 4·TR²+5.
Estado de cada métrica: rango clínico + % de cambio vs la línea base personal (Pre). Reglas en `src/sim/heart.js`.

## Pantallas
- **Heart monitor** (menú principal, estructura de la pantalla de la ISS): tabla de eco por tiempos (izq.), corazón interactivo que late a la FC medida (centro), puntaje cardíaco + barra de masa VI vs base (der.), hallazgos y acciones (abajo izq.), línea de tiempo de % de cambio (abajo). Botón ▶ Replay recorre el estudio.
- **Countermeasures**: comparación por grupo (Control −13.7 % masa VI a D70 vs Exercise B −2.9 %) y tabla de la tripulación.
- **Daily check-in**: ánimo, estrés, sueño, síntomas.
- **EVA & radiation**: módulo simulado de radiación con alerta exponencial (escenarios demo).

## Alerta exponencial
`src/sim/analytics.js → detectExponential()`: regresión lineal de `log(dosis)` vs tiempo en una ventana de 6 min.
Si R² ≥ 0.9, el valor subió ≥ 1.5× y el tiempo de duplicación ≤ 30 min → alerta, con tiempo de duplicación y minutos hasta el nivel crítico.

## Demo (barra inferior, 1 s = 1 min)
Nominal · ☀ Solar storm · CO₂ buildup · Fatigue week · ↺ Log (restablece el historial de ejemplo).

## Estructura
```
src/data/       config.js (umbrales, misiones) · evidence.js (datasets NLSP citados)
src/sim/        useSimulation (motor) · analytics (regresión/exponencial) · health (reglas, alertas, sistemas) · history (check-ins)
src/components/ ui.jsx (Card, gauges, sparkline, iconos) · BodyFigure.jsx
src/views/      Overview · CheckIn · Eva · Trends · Panels (drawer/modales)
```
Datos en vivo simulados y calibrados con rangos clínicos + NLSP (`../nlsp-data`). Cambia umbrales en `src/data/config.js`.
