# ORBIT CARE — v1 (Astronaut Health Monitor)

NASA Space Apps 2026 · "Create Health Monitoring Software for Astronauts on Space Missions".
**Primera versión** del frontend. Diseño: fusión de las propuestas **2 (Dark/Tech)** + **3 (Glass/Modern)** — Orbitron + Plus Jakarta Sans.

## Correr
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # versión estática en dist/
```
100% offline: sin APIs, fuentes empaquetadas localmente, check-ins guardados en el navegador.

## Pantallas
- **Overview**: radiación (gauge log + dosis de carrera), cabina (CO₂, O₂, presión, T, humedad, ruido), vitales (FC, HRV, SpO₂, PA, temp, resp, glucosa), figura del cuerpo holográfica con sistemas clicables, puntaje general y los 5 peligros de la NASA.
- **Daily check-in**: ánimo, estrés, energía, conexión social, sueño, síntomas, nota → guía inmediata + racha/insignias.
- **EVA mode**: tiempo restante, radiación exterior, traje (O₂, presión, CO₂, metabolismo), "return-by".
- **Trends**: 14 días + correlaciones calculadas a bordo.
- Panel lateral por sistema: indicadores, por qué importa, riesgo NASA HRP, cómo medir, qué hacer, evidencia NLSP.
- Reporte compacto para el médico de vuelo.

## Alerta exponencial
`src/sim/analytics.js → detectExponential()`: regresión lineal de `log(dosis)` vs tiempo (ventana de 6 min).
Si R² ≥ 0.9, el valor subió ≥ 1.5× y el tiempo de duplicación ≤ 30 min → alerta con tiempo de duplicación y minutos hasta el nivel crítico.

## Demo (1 s = 1 min)
Nominal · Solar storm · CO₂ buildup · Fatigue week · ↺ Log.

## Datos
Lecturas en vivo simuladas, calibradas con rangos clínicos; cada alerta cita datasets del NASA Life Sciences Portal (NLSP) en `src/data/evidence.js`.

> La versión siguiente (carpeta `orbit-care`) cambia la fuente de datos a la ecocardiografía del estudio BRSMCF CFT70 y rediseña la interfaz.
