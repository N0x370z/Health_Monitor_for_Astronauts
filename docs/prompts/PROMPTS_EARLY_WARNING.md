# Bitácora de Prompts y Arquitectura: Sistema de Monitoreo de Salud Espacial (NLSP + CFT70)

> Parte: validación de alerta temprana (`backend/src/services/mining.js`). Los valores citados dentro de los prompts son de una corrida previa; los resultados vigentes los da `GET /api/analytics/early-warning` (p de permutación 0.009).

Este documento recopila la secuencia completa de prompts de diseño, ingeniería de datos y bioestadística utilizados para construir el motor analítico del monitor de salud, conectando la exploración de metadatos de la NASA con la implementación matemática sin dependencias (`mining.js`).

---

## Fase 1: Selección de Métodos de Minería de Datos y Riesgos Espaciales

### Prompt
> "Actúa como un arquitecto de sistemas biomédicos espaciales. Necesito diseñar el motor analítico de un monitor de salud para tripulaciones expuesto a los cinco riesgos principales de los vuelos espaciales humanos de la NASA (radiación espacial, aislamiento y confinamiento, distancia de la Tierra, campos gravitatorios y ambientes hostiles/cerrados). ¿Qué técnicas de minería de datos y aprendizaje automático recomiendas para correlacionar estas dimensiones ambientales con variables fisiológicas y detectar deterioro temprano antes de que ocurra un evento clínico crítico?"

* **Relación con la arquitectura:** Establece la necesidad de separar alertas puntuales por umbral fijo de la detección de tendencias acumulativas en el tiempo, fundamentando la posterior implementación de `cusumLower()` y `mahalanobisModel()` en `mining.js`.

---

## Fase 2: Auditoría de Esquemas Relacionales y Limpieza de Datos (NLSP)

### Prompt
> "Te proporciono los metadatos del NASA Life Sciences Portal (NLSP: `experiments_human.csv`, `missions.csv` y los 11 subconjuntos temáticos `datasets_human_<tema>.csv`). Analiza la granularidad y las llaves primarias/foráneas de cada tabla (`experiment_id`, `mission_id`, `dataset_catalog`). Determina si conviene desnormalizar todo en un único CSV plano o mantener un esquema relacional para evitar sesgos estadísticos por relaciones muchos-a-muchos, e identifica qué columnas administrativas deben purgarse antes de vectorizar los parámetros médicos."

* **Relación con la arquitectura:** Evita la duplicación de registros al hacer muestreo de sujetos y define el preprocesamiento limpio necesario antes de calcular matrices de covarianza o probabilidades.

---

## Fase 3: Implementación Matemática Sin Dependencias (`mining.js`)

### Prompt
> "Desarrolla en JavaScript puro (ES Modules, cero dependencias externas) un módulo de validación estadística y detección de anomalías (`mining.js`) diseñado específicamente para cohortes clínicas pequeñas ($n \approx 30\text{--}40$ sujetos, como estudios de reposo en cama análogos a microgravedad), donde los supuestos de normalidad paramétrica fallan y existe alto riesgo de sobreajuste. Implementa:
> 1. Un generador pseudoaleatorio determinista con semilla (`mulberry32`) para garantizar reproducibilidad exacta.
> 2. Cálculo de capacidad discriminativa mediante **AUC (estadístico U de Mann-Whitney)** acompañado de **intervalos de confianza al 95% por bootstrap** no paramétrico y **pruebas de permutación exacta/Monte Carlo** ($B = 5000$).
> 3. Un clasificador de **Regresión Logística con regularización L2 (Ridge)** optimizado mediante **Newton-Raphson** (sin penalizar el intercepto), evaluado estrictamente fuera de muestra mediante **validación cruzada Leave-One-Subject-Out (LOSO)**, estandarizando media y desviación estándar dentro de cada pliegue para evitar fuga de datos (*data leakage*).
> 4. Métricas de calibración probabilística (**Brier Score** y **Brier Skill Score** frente a la prevalencia base) y matriz de confusión.
> 5. Detección multivariada de anomalías mediante **Distancia de Mahalanobis con contracción hacia la matriz identidad (*shrinkage*)** para estabilizar la inversión de la matriz de covarianza en muestras pequeñas.
> 6. Detección secuencial de deterioro sostenido a la baja mediante **CUSUM unilateral inferior**, normalizado en unidades de error estándar de medición ($\text{SEM}$) con parámetros de holgura $k = 0.5$ y umbral de alarma $h = 4$.
> 7. Una función integradora `evaluateEarlySignal()` que evalúe si un cambio temprano (ej. Día 7) predice un evento clínico al final del estudio ($\text{pérdida} \ge \text{MDC}_{95}$), comparando el modelo univariado frente al modelo ajustado por contramedida de ejercicio."

* **Funciones implementadas en `mining.js`:** `rng()`, `rocAuc()`, `permutationAuc()`, `bootstrapAucCI()`, `logisticRidge()`, `leaveOneOutLogistic()`, `brier()`, `confusion()`, `mahalanobisModel()`, `cusumLower()`, y `evaluateEarlySignal()`.

---

## Fase 4: Integración en el Motor de Evaluación Clínica y API (`analytics.js`, `assessment.js`, `study.js`)

### Prompt
> "Integra el módulo `mining.js` dentro del flujo operativo de la API del monitor de salud:
> - En `analytics.js`, implementa `earlyWarningValidation()` para evaluar la cohorte CFT70 ($n=35$) y `trajectoryAlarm()` para ejecutar el filtro CUSUM hasta el `timepoint` consultado sin mirar datos futuros.
> - En `assessment.js`, traduce la detección positiva del CUSUM en un nuevo tipo de recomendación (`kind: 'trend'`). Calibra su severidad como advertencia (`level: 'warning'`) y no como crítica (`level: 'critical'`), justificando la decisión en los resultados fuera de muestra ($\text{AUC}_{LOSO} = 0.67$, $\text{Brier Skill} = 0.09$, $p = 0.012$).
> - En `study.js`, expón el endpoint `GET /api/analytics/early-warning`."

* **Impacto en la salida JSON:** Inyecta recomendaciones preventivas de trayectoria (ej. `"Tendencia sostenida a la baja en Masa del VI (eco 3D) (desde D7)"`) sin distorsionar el puntaje de severidad puntual (`score`).

---

## Fase 5: Interpretación Clínica y Consumo en Frontend

### Prompt
> "Analiza la respuesta JSON generada por el endpoint de evaluación para el sujeto `S6319` del grupo `CONTROL` en el día 70 (`BR70`). Explica cómo interactúa la nueva alerta `kind: 'trend'` en la masa del ventrículo izquierdo (`lv_mass`) con las alertas puntuales existentes (`AR06`, `AR04`), el índice de desacondicionamiento (`0.72`) y la recomendación de contramedida (`EXERCISE_B`), y proporciona patrones de código en JavaScript para desacoplar y visualizar estas alertas de tendencia en la interfaz de usuario."