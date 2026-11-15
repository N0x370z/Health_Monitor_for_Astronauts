// Capa de datos: alertas del tripulante desde la API, con respaldo local si la API no responde.
import { useEffect, useState } from "react";
import { apiJson } from "./api.js";
import { TIMEPOINTS } from "./echo.js";
import { alertsFromApi, alertsFromFindings } from "../domain/alerts.js";

/** Alertas del sujeto en un momento del estudio: { list, source: "api" | "local" }. */
export function useCrewAlerts(subjectId, tpKey, findings) {
  const [api, setApi] = useState({ key: null, list: null });
  const key = `${subjectId}|${tpKey}`;

  useEffect(() => {
    let alive = true;
    const label = TIMEPOINTS.find((t) => t.key === tpKey)?.label;
    apiJson(`/api/subjects/${encodeURIComponent(subjectId)}?timepoint=${encodeURIComponent(label)}`)
      .then((body) => { if (alive) setApi({ key, list: alertsFromApi(body) }); });
    return () => { alive = false; };
  }, [subjectId, tpKey, key]);

  // Mientras llega la respuesta, o si la API no está, se usa el estado calculado en el navegador.
  if (api.key === key && api.list) return { list: api.list, source: "api" };
  return { list: alertsFromFindings(findings), source: "local" };
}
