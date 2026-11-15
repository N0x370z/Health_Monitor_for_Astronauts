import { config } from './config.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': config.corsOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

/** Router mínimo: rutas GET con parámetros `:nombre`. */
export class Router {
  #routes = [];

  get(pattern, handler) {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$',
    );
    this.#routes.push({ regex, keys, handler });
  }

  match(pathname) {
    for (const r of this.#routes) {
      const m = pathname.match(r.regex);
      if (m) {
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        return { handler: r.handler, params };
      }
    }
    return null;
  }
}
