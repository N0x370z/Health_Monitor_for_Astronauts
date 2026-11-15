// Función de Vercel: sirve la API del backend (backend/src) en /api/* del mismo dominio que el frontend.
// La base data/health_monitor.sqlite se referencia con new URL(...) para que Vercel la incluya en la función.
import { fileURLToPath } from 'node:url';

process.env.DB_PATH ??= fileURLToPath(new URL('../../data/health_monitor.sqlite', import.meta.url));
const { handle } = await import('../../backend/src/server.js');

export default function handler(req, res) {
  return handle(req, res);
}
