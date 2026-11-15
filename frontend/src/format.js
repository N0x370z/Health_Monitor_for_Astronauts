export const STATUS_LABEL = { normal: 'Normal', warning: 'Atención', critical: 'Crítico' };

export const ROLE_LABEL = {
  Commander: 'Comandante',
  'Flight Engineer': 'Ingeniero de vuelo',
  'Medical Officer': 'Oficial médico',
  'Mission Specialist': 'Especialista',
};

export const GROUP_COLOR = {
  CONTROL: 'var(--critical)',
  EXERCISE_A: 'var(--series-1)',
  EXERCISE_B: 'var(--series-2)',
  FLYWHEEL: 'var(--series-3)',
};

export const VITALS = [
  { code: 'heart_rate', label: 'FC', unit: 'lpm', digits: 0 },
  { code: 'systolic_bp', label: 'PAS', unit: 'mmHg', digits: 0 },
  { code: 'spo2', label: 'SpO₂', unit: '%', digits: 1 },
  { code: 'body_temp', label: 'Temp', unit: '°C', digits: 1 },
];

export function fmt(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toLocaleString('es-MX', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtPct(value) {
  if (value === null || value === undefined) return '';
  return `${value > 0 ? '+' : ''}${fmt(value, 1)} %`;
}

export function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
