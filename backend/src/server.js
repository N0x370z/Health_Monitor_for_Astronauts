import { createServer } from 'node:http';
import { config } from './config.js';
import { get } from './db.js';
import { HttpError, Router, sendJson } from './http.js';
import { register as crewRoutes } from './routes/crew.js';
import { register as knowledgeRoutes } from './routes/knowledge.js';
import { register as studyRoutes } from './routes/study.js';

const router = new Router();
router.get('/api/health', () => ({
  status: 'ok',
  database: config.dbPath.split('/').slice(-2).join('/'),
  crew: get('SELECT COUNT(*) AS n FROM crew_member').n,
  time_shift: config.timeShift,
}));
crewRoutes(router);
knowledgeRoutes(router);
studyRoutes(router);

export function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': config.corsOrigin, 'Access-Control-Allow-Methods': 'GET, OPTIONS' });
    return res.end();
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Solo se permite GET' });
  const route = router.match(url.pathname);
  if (!route) return sendJson(res, 404, { error: `Ruta no encontrada: ${url.pathname}` });
  try {
    sendJson(res, 200, route.handler(route.params, url.searchParams));
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    sendJson(res, status, { error: status === 500 ? 'Error interno' : err.message });
  }
}

export const server = createServer(handle);

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(config.port, () => {
    console.log(`API de monitoreo cardiovascular en http://localhost:${config.port}/api/health`);
  });
}
