# Prompts clave — Frontend "ORBIT CARE"

NASA Space Apps Challenge 2026 · Reto *Create Health Monitoring Software for Astronauts on Space Missions*.

Este documento reúne, ya depurados y estructurados, los prompts que más pesaron en la construcción del frontend de ORBIT CARE (React + Vite, offline, datos BRSMCF CFT70). Están ordenados en el mismo orden en que se construyó la app, para que cualquier persona del equipo pueda **reproducir o extender** el trabajo con un asistente de código.

---

## Cómo usar estos prompts

1. **Un solo chat por proyecto.** Pega primero el *Prompt 0 (contexto maestro)* y después los demás en orden. Cada prompt asume que el anterior ya está hecho.
2. **Un cambio por prompt.** Si mezclas diseño, datos y lógica en un mismo mensaje, el resultado se vuelve genérico. Pide una cosa y verifica.
3. **Siempre exige verificación.** Cada prompt termina con *criterios de aceptación*: pide al asistente que corra lint/build y que lo compruebe en el navegador antes de darlo por terminado.
4. **Adjunta referencias visuales.** Cuando el prompt diga *[adjuntar imagen]*, una captura vale más que un párrafo: señala con flechas o texto lo que quieres cambiar.
5. **Cuida la honestidad de los datos.** Todo lo simulado o completado debe decir que lo es (en la interfaz o en el código).

Estructura de cada prompt:

| Bloque | Para qué sirve |
|---|---|
| **Rol** | Qué tipo de experto debe ser el asistente |
| **Contexto** | Lo que ya existe y por qué se pide el cambio |
| **Tarea** | Lo que hay que construir, en pasos concretos |
| **Restricciones** | Lo que NO se debe hacer o tocar |
| **Criterios de aceptación** | Cómo sabremos que quedó bien |

---

## Prompt 0 · Contexto maestro (siempre primero)

```
ROL
Eres un ingeniero frontend senior especializado en React y visualización de datos de salud.

CONTEXTO DEL PRODUCTO
Estamos en NASA Space Apps 2026, reto "Create Health Monitoring Software for Astronauts on Space Missions".
Construimos "ORBIT CARE", un gestor de salud para astronautas:
- El astronauta lleva un registro diario (ánimo, sueño, estrés, síntomas).
- La app muestra el estado de su corazón con datos reales de ecocardiografía.
- Funciona 100% offline dentro de la base: no hay APIs ni internet.

DATOS (única fuente permitida)
Estudio BRSMCF CFT70: 70 días de reposo en cama con inclinación −6° (análogo de microgravedad).
Tres CSV que adjunto:
1. "BRSMCF CFT70 Echo All Data.csv"  → 37 sujetos, eco 2D/Doppler/TDI, momentos Pre, D7, D70, R+0, R+3.
2. "BRSMCF CFT70 3D Echo Data.csv"   → masa VI, volúmenes (EDV/ESV), 2 analistas, incluye D21 y D30.
3. "BRSMCF CFT70 Echo 7 Subjects.csv" → subconjunto de 7 sujetos ("crew").
Grupos: Control, Exercise A, Exercise B, Flywheel.

STACK
JavaScript + React 19 + Vite. Sin TypeScript. ESLint activado. Fuente Roboto (@fontsource).
Los CSV se empaquetan dentro del código (import "?raw"), nada se descarga en ejecución.

REGLAS GENERALES
- Textos de la interfaz en inglés; comentarios del código en español.
- No usar el logo de la NASA.
- Nada de valores inventados sin decirlo: lo simulado se etiqueta como simulado.
- Antes de terminar cada tarea: corre lint y build, y verifica en el navegador.

Confirma que entendiste el contexto en 5 líneas y espera mi primera tarea.
```

---

## Prompt 1 · Proyecto base y capa de datos

```
ROL
Ingeniero de datos + frontend.

TAREA
1. Crea el proyecto con Vite (plantilla react) en la carpeta "orbit-care".
2. Copia los 3 CSV a src/data/echo/ y cárgalos con import "?raw".
3. Escribe un parser CSV propio (soporta comillas y saltos de línea \r\n).
4. Normaliza valores faltantes: "NA", "N/A", vacío y 0.00 → null.
5. Construye un objeto ECHO = { subjects, crewIds } donde cada sujeto tiene:
   id, treatment, crew (bool), tp: { pre, d7, d21, d30, d70, r0, r3 } → métricas.
6. En los datos 3D, promedia los dos analistas.
7. Calcula métricas derivadas con fórmulas estándar:
   - HR = TDI Left HR (si falta, TDI Right HR)
   - FS = (LVIDd − LVIDs) / LVIDd
   - SV = EDV − ESV ;  EF = SV / EDV ;  CO = SV × HR / 1000
   - E/A ;  E/e′ (e′ = promedio lateral y septal)
   - Tei = (ICT + IVRT) / ET ;  RVSP = 4·(TR/100)² + 5
8. Exporta TIMEPOINTS con key, label corto y descripción larga.

RESTRICCIONES
- Ignora al sujeto con tratamiento "Unassigned" en estadísticas de grupo.
- No uses librerías de CSV.

CRITERIOS DE ACEPTACIÓN
- Imprime en consola: número de sujetos (37), los 7 IDs del crew y un sujeto de ejemplo con todas sus métricas.
- Cambio de masa VI a D70 por grupo ≈ Control −13.7 %, Exercise A −7.1 %, Exercise B −2.9 %, Flywheel −4.9 %.
```

---

## Prompt 2 · Motor de estado del corazón

```
ROL
Ingeniero biomédico de software.

TAREA
Crea src/sim/heart.js con:
1. HM: definición de cada métrica (label, unidad, decimales, umbrales clínicos warnLo/warnHi/critLo/critHi,
   y umbrales de cambio % vs la línea base personal dWarn/dCrit).
2. reading(subject, tp, key) → { valor, base (Pre), % de cambio, estado }.
   Estados posibles: ok, watch, warn, crit, none.
3. CHAMBERS: 5 regiones del corazón, cada una con sus métricas, "por qué importa",
   "cómo se mide" y "qué hacer":
   - Left ventricle (masa, EDV, EF, FS…)
   - Mitral valve (E/A, E/e′, DT)
   - Aortic outflow (VTI, SV, CO)
   - Right ventricle (TDI S′, RVSP)
   - Rate & timing (HR, Tei)
4. heartState(): puntaje 0–100 por región y global, y estado peor.
5. findings(): lista de hallazgos ordenados por gravedad, en lenguaje simple.
6. groupChange() y bestCountermeasure(): comparan grupos usando SOLO datos originales.

CRITERIOS DE ACEPTACIÓN
- Un hallazgo se lee como: "LV volume −30% — less blood filling the heart".
- Ningún cálculo devuelve NaN.
```

---

## Prompt 3 · Diseño principal (referencia visual)

```
ROL
Diseñador UI + desarrollador React con criterio visual alto.

CONTEXTO
[adjuntar captura de la página de SpaceGenes+ (Space Apps 2025) como referencia de estilo]
Quiero un panel principal con el CORAZÓN como protagonista (como figura central del panel),
con el estilo claro de la imagen de referencia. Toma la referencia SOLO como guía de estilo.

TAREA
1. Tema claro: fondo #f2f5fb, barra lateral azul marino (#1b3358), azul primario #3b82f6. Fuente Roboto.
2. Barra lateral con marca, navegación (Heart monitor, Countermeasures, Daily check-in) y sujeto activo.
3. En móvil: barra superior + navegación inferior de 3 pestañas.
4. Pestaña Heart monitor, en cuadrícula:
   - Fila de 4 KPIs en tarjetas pastel: estado del corazón, momento del estudio (‹ › Replay),
     contramedida y pulso.
   - Tarjeta azul marino con el corazón holográfico (EF, CO, pulso, SpO₂ debajo).
   - Findings tipo línea de tiempo, gráfica "Your metrics" con control segmentado All/Size/Flow,
     Reminders con casillas, Health tips, resumen con barras y tabla completa de ecocardiografía.

RESTRICCIONES (importante)
- Nada de detalles genéricos: un botón seleccionado NO debe verse como una pastilla con brillo
  [adjuntar captura del botón genérico]. Usa estados sólidos y limpios.
- Nada de emojis del sistema: usa íconos SVG propios.
- Sin desbordes horizontales a 375 px de ancho.

CRITERIOS DE ACEPTACIÓN
- Capturas en escritorio (1400 px) y móvil (375 px) sin textos encimados.
```

---

## Prompt 4 · Corazón interactivo y panel lateral

```
TAREA
1. Dibuja el corazón en SVG (degradado verde→azul, malla holográfica), con 5 regiones clicables
   y etiquetas que muestren nombre, estado y puntaje.
2. El corazón late al ritmo del pulso del sujeto (duración de la animación = 60 / HR).
3. Al tocar una región:
   - ilumina SOLO el contorno de esa región (blanco con brillo + borde del color de su estado);
   - NO muestres el recuadro de foco del navegador;
   - abre un panel que entra deslizándose desde la derecha (slide from the right) y sale igual.
4. El panel muestra: indicadores con su % vs Pre, por qué importa, cómo se mide y qué hacer.
5. Esc o clic fuera cierra el panel.

CRITERIOS DE ACEPTACIÓN
- La animación de salida se completa antes de desmontar el panel.
- Funciona con teclado (Enter sobre la región).
```

---

## Prompt 5 · Botón "Random data"

```
CONTEXTO
Para la presentación necesitamos mostrar distintas personas rápido.

TAREA
1. Sustituye el botón de notificaciones por un botón "Random data" con ícono de dado.
2. Al tocarlo, elige un sujeto al azar (excluyendo "Unassigned") y un momento del estudio
   que exista en los CSV; cambia a la pestaña Heart y muestra "Loaded: Subject X · D70 · Control".
3. Como es OTRA persona, reinicia el Daily check-in (formulario, Last 7 days y Badges).

CRITERIOS DE ACEPTACIÓN
- Guardar un check-in → Random data → el check-in vuelve a "Start your log today".
```

---

## Prompt 6 · Completar datos faltantes con la misma base

```
CONTEXTO
Hay celdas que muestran "Error" porque el estudio no midió esa métrica en ese momento.
Para que la presentación se vea completa, quiero rellenarlas SOLO con datos de la misma base.

TAREA
Para cada sujeto × momento × métrica faltante, usa en este orden:
1. El valor del MISMO sujeto en el momento medido más cercano (empate → el anterior).
2. Si el sujeto nunca midió esa métrica: la media de SU grupo en ese momento.
3. Si no existe: la media de todos los sujetos en ese momento; por último, la media del estudio.
Guarda una copia "raw" con los datos originales y un mapa "filled" con el origen de cada valor.

RESTRICCIONES
- Las comparaciones entre grupos (evidencia) deben seguir usando solo "raw".
- En la tabla, los valores completados van en cursiva y su tooltip dice de dónde salieron.

CRITERIOS DE ACEPTACIÓN
- 0 valores vacíos en toda la base; los % por grupo no cambian.
```

---

## Prompt 7 · Pulso y SpO₂ en vivo + cardiograma

```
CONTEXTO
Es un prototipo: quiero que los signos cambien con el paso de los segundos, sin modificar la base.

TAREA
1. Hook useLiveVitals(subject, timepoint) que cada segundo actualice:
   - Pulso: parte del HR REAL de la base y varía con arritmia sinusal respiratoria (~±2 bpm, ciclo de 5 s)
     + ruido con reversión a la media (Ornstein-Uhlenbeck), limitado a base −12 / +14 bpm.
   - SpO₂: no está en la base → simúlala alrededor de 98 % (93–100 %) con caídas breves ocasionales
     y dilo en pantalla ("Not in database · reference 98%").
   - Guarda los últimos 60 segundos para mini gráficas.
   - Se reinicia al cambiar de sujeto o de momento.
2. En el panel "Rate & timing", agrega un monitor oscuro con:
   - ECG en <canvas> en modo barrido (como monitor de hospital), onda PQRST sintética
     a 250 Hz, con la frecuencia del pulso simulado y cuadrícula de papel milimétrico;
   - recuadros de Pulse y SpO₂ con valor grande y mini gráfica.
3. Muestra el pulso y la SpO₂ en vivo en la tarjeta KPI y bajo el corazón, con etiqueta "LIVE SIM".

RESTRICCIONES
- Si el sujeto no tiene HR en la base: "NO SIGNAL" en lugar de inventar.
- Respeta prefers-reduced-motion.

CRITERIOS DE ACEPTACIÓN
- El ECG se dibuja fluido y su ritmo coincide con el número de bpm mostrado.
```

---

## Prompt 8 · Daily check-in interactivo

```
CONTEXTO
[adjuntar captura de "Last 7 days" y "Badges" en estado de error]
Esos paneles dicen "no data in database". Quiero que inviten a empezar el registro y reaccionen al guardarlo.

TAREA
1. Estado vacío amable: "Start your log today — save your first check-in and your mood, sleep and stress will appear here."
2. Last 7 days: 3 filas (Mood, Sleep, Stress) × 7 columnas (D64…Today) con barras que crecen
   animadas al guardar; la columna de hoy resaltada.
3. Badges: First log, Week in orbit (x/7), Sleep keeper (≥ 7 h), Good vibes (ánimo ≥ 4),
   Calm & strong (estrés ≤ 2 y energía ≥ 4). Bloqueadas en gris, desbloqueadas a color, con el criterio visible.
4. Chip de racha: "Start your streak" → "1-day streak".
5. El registro vive solo en memoria (al recargar se borra; es para presentar).
```

---

## Prompt 9 · Limpieza y navegación de consejos

```
TAREA
1. Elimina: botón "Report to flight surgeon", botón "Full report" de Findings,
   el desplegable de sujetos (el sujeto se muestra fijo) y la franja de cobertura de datos.
2. Health tips: agrega flechas ‹ › a los lados de los puntos y mantén el deslizamiento
   con el dedo en móvil (umbral de 40 px). Transición suave entre consejos.

CRITERIOS DE ACEPTACIÓN
- Lint sin advertencias de imports sin usar.
```

---

## Prompt 10 · Tutorial guiado al entrar

```
CONTEXTO
[adjuntar imagen del globo "Try the new pull requests Overview page!" de GitHub]
Cada vez que alguien entre a la página debe salir un pequeño tutorial de botones y funciones con ese estilo.

TAREA
1. Componente Tour con "coach marks": globo oscuro (#0d1117, borde #30363d) con flechita que apunta
   al elemento, el resto de la pantalla oscurecido y el elemento resaltado con borde azul.
2. Cabecera "✨ Quick tour · n of 8", título, descripción y botones Next / Back / Not now (último: Got it).
3. Pasos: Random data → Study timepoint → Pulse·SpO₂ → Corazón → Your metrics → Health tips
   → Countermeasures → Daily check-in.
4. Ancla los pasos con atributos data-tour; si un elemento no está visible (móvil/escritorio), usa el visible o salta el paso.
5. Se coloca abajo o arriba según el espacio; se recalcula al hacer scroll o cambiar tamaño.
6. Teclado: Enter/→ avanza, ← retrocede, Esc cierra (sin avanzar dos veces cuando el foco está en un botón).

CRITERIOS DE ACEPTACIÓN
- Aparece en cada recarga, recorre los 8 pasos uno por uno y nunca se sale de la pantalla a 375 px.
```

---

## Prompt 11 · Verificación (usar después de cada cambio)

```
Antes de dar la tarea por terminada:
1. Corre "npx eslint src" y "npx vite build"; corrige todo error o advertencia.
2. Abre la app en el navegador a 1400 px y a 375 px y toma capturas de la parte cambiada.
3. Prueba el flujo completo del cambio (clics reales, no solo leer el código).
4. Dime qué verificaste y qué NO pudiste verificar.
```

---

## Prompt 12 · Evidencia en Git (sin pisar el trabajo del equipo)

```
CONTEXTO
Repositorio del equipo: https://github.com/N0x370z/Health_Monitor_for_Astronauts
Ramas del equipo: main, Neo, jona (NO tocar). Nuestras ramas: v1-frontend y v2-frontend.

TAREA
1. Copia la versión actual a la carpeta del repositorio (excluye node_modules y dist).
2. Verifica con diff que ambas carpetas son idénticas.
3. Haz commit en v2-frontend con un mensaje que describa los cambios en viñetas.
4. Haz push SOLO a v2-frontend y confirma con "git ls-remote" que el remoto quedó en el commit nuevo.

RESTRICCIONES
- No hacer merge ni push a main; la integración se hará después con un Pull Request revisado por el equipo.
```

---

## Lecciones aprendidas

- **Referencias > adjetivos.** "Más moderno" no sirve; una captura con "esto se ve genérico" sí.
- **Pedir lo que NO se debe tocar** evitó romper la versión que ya funcionaba ("no toques la actual").
- **Separar datos reales, completados y simulados** mantuvo la app honesta frente al jurado.
- **Verificar en el navegador** detectó errores que el lint no ve (tutorial que avanzaba dos pasos, textos cortados en móvil).
