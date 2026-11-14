import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

// Una sola conexión de solo lectura; las consultas preparadas se reutilizan.
export const db = new DatabaseSync(config.dbPath, { readOnly: true });
db.exec('PRAGMA query_only = ON');

const cache = new Map();

export function all(sql, ...params) {
  return prepared(sql).all(...params);
}

export function get(sql, ...params) {
  return prepared(sql).get(...params);
}

function prepared(sql) {
  let stmt = cache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    cache.set(sql, stmt);
  }
  return stmt;
}
