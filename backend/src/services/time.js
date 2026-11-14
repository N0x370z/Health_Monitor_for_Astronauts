import { config } from '../config.js';
import { get } from '../db.js';

// Los datos sintéticos terminan en una fecha fija. Con TIME_SHIFT=true se desplazan
// para que la ventana de 24 h termine en el momento de la consulta.
const dataEnd = Date.parse(get('SELECT MAX(ts) AS ts FROM measurement').ts);
const DAY = 86_400_000;

const STEP = 300_000; // 5 min: el desplazamiento se redondea para que todas las series compartan marcas de tiempo

function offsetMs() {
  return config.timeShift ? Math.floor((Date.now() - dataEnd) / STEP) * STEP : 0;
}

export function shiftTs(ts) {
  return new Date(Date.parse(ts) + offsetMs()).toISOString();
}

export function shiftDate(date) {
  const days = Math.round(offsetMs() / DAY);
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** Inicio (en tiempo de la base) de una ventana de `hours` horas que termina en el último dato. */
export function windowStart(hours) {
  return new Date(dataEnd - hours * 3_600_000).toISOString().replace('.000Z', 'Z');
}
