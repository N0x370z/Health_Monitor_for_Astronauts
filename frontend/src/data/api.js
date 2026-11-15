// Capa de datos: cliente HTTP de la API del backend (lee data/health_monitor.sqlite).
// En desarrollo Vite manda /api al backend local; en Vercel, a la función api/. VITE_API_URL apunta a otro dominio.
export const API_BASE = import.meta.env.VITE_API_URL ?? "";

let online = false;
/** true después de que la API respondió al cargar la app. */
export const apiOnline = () => online;
export const setApiOnline = (v) => { online = v; };

/** GET que lanza error si la API falla o tarda más de `timeout` ms. */
export async function getJson(path, timeout = 5000) {
  const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** GET que devuelve null si la API no está disponible (para datos opcionales). */
export async function apiJson(path) {
  if (!online) return null;
  try {
    return await getJson(path);
  } catch {
    return null;
  }
}
