// Capa de datos: densitometría ósea (DXA, NASA MR035G) desde la API. No hay respaldo offline:
// si la API no responde, la pantalla lo dice en lugar de inventar valores.
import { getJson } from "./api.js";

export const loadBoneSummary = () => getJson("/api/bone");
export const loadBoneSubjects = () => getJson("/api/bone/subjects");
export const loadBoneSubject = (code) => getJson(`/api/bone/subjects/${encodeURIComponent(code)}`);
