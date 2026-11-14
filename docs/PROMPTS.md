# Prompts útiles

Prompts que funcionaron bien al construir este proyecto con un asistente de IA, ordenados por etapa. Se pueden reutilizar o adaptar; las rutas son las de este proyecto.

## 1. Limpieza y exploración de datos
- *"Revisa los .csv de `<carpeta>` y límpialos para un monitor de salud de astronautas: conserva solo filas y columnas relacionadas con `<temas>` y elimina las columnas administrativas. No modifiques los originales; guarda los resultados en otra carpeta."*
- *"Analiza `<archivo.csv>`: columnas, tipos, valores faltantes, duplicados, sujetos, fases y grupos. Dime si dos archivos son iguales y si un archivo es subconjunto de otro."*
- *"Calcula el cambio porcentual medio respecto a la línea base por grupo y momento para `<métricas>`, y dime qué problema cardiovascular muestran los datos."*
- *"Revisa si alguna columna contiene nombres o datos personales y propón cómo anonimizarla."*

## 2. Fuentes y verificación
- *"Accede a las URL del catálogo (`nlsp_url`), identifica los resultados de cada experimento y, si un experimento no tiene resultados, busca evidencia alternativa dentro de la misma base. Infórmame de errores o inconvenientes."*
- *"Verifica cada cita y cada DOI en internet (Crossref, PubMed, documento original) y corrige lo que no cuadre. Dime qué confirmaste y qué cambiaste."*
- *"¿Este dato viene de la NASA o de otra fuente? Sepáralo en datos reales, fuentes externas e inventados por el proyecto."*
- *"Busca en el catálogo NASA evidencia de contramedidas para `<problema>` y cita los resultados exactos."*

## 3. Base de datos
- *"Diseña un esquema normalizado (3FN) para `<objetivo>` con llaves foráneas, índices y vistas para el backend. Documenta cada tabla."*
- *"Importa `<archivos.csv>` a la base: normaliza etiquetas, convierte a formato largo, marca la calidad de cada dato y guarda el resumen por grupo."*
- *"Define umbrales de alerta absolutos (guías clínicas) y de cambio respecto a la línea base personal (derivados de `<estudio>`), cada uno con su fuente y nivel de confianza."*
- *"Crea datos sintéticos anónimos calibrados con `<estudio>` e inyecta eventos etiquetados para probar si las alertas los detectan. Mide las falsas alarmas."*
- *"Escribe consultas SQL de ejemplo para `<preguntas>` y pruébalas contra la base."*

## 4. Backend
- *"Desarrolla el backend sin FastAPI ni frameworks, leyendo directamente `data/health_monitor.sqlite` en modo solo lectura. Estructura: configuración, conexión, rutas y servicios. Incluye pruebas."*
- *"Implementa la lógica de prevención: convierte el estado de las mediciones en alertas con nivel, acción recomendada y contramedida, y calcula un índice de riesgo por tripulante."*
- *"Mide el tiempo de respuesta de cada endpoint y revisa que las alertas de cada tripulante tengan sentido clínico."*

## 5. Frontend
- *"Crea un frontend con React y Recharts, con un diseño limpio y claro: vista general de la tripulación por riesgo, detalle de cada tripulante con signos vitales de 24 h, alertas con acción recomendada y tendencia de ecocardiogramas comparada con el estudio de referencia."*
- *"Toma capturas de la interfaz con un navegador sin interfaz gráfica y corrige lo que se vea mal (gráficas, espacios, textos que se enciman)."*

## 6. Documentación
- *"Documenta de manera formal qué se hizo: objetivo, método por fases, decisiones, validación, limitaciones y bitácora de cambios."*
- *"Cita y declara las fuentes: qué datos son reales, cuáles son sintéticos, cómo citar cada registro y qué umbrales son heurísticas del proyecto."*
- *"Documenta los archivos del repositorio y los cambios de esta versión."*

## Buenas prácticas observadas
- Pedir que **verifique** (pruebas, consultas, capturas) antes de dar algo por terminado.
- Pedir que **separe hechos de supuestos**: unidades inferidas, umbrales heurísticos, citas sin verificar.
- Dar las restricciones desde el inicio: sin datos personales, sin cierto framework, qué no modificar.
