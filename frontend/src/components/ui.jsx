import { STATUS_LABEL, fmt, fmtPct } from '../format.js';

export function Badge({ level, children }) {
  return <span className={`badge ${level}`}>{children ?? STATUS_LABEL[level]}</span>;
}

export function Dot({ level }) {
  return <span className={`dot ${level}`} aria-label={STATUS_LABEL[level]} />;
}

export function Card({ title, hint, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || hint) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {hint && <span className="hint">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Loading({ state, children }) {
  if (state.error && !state.data) return <div className="state error">No se pudo cargar: {state.error.message}</div>;
  if (!state.data) return <div className="state">Cargando…</div>;
  return children(state.data);
}

export function AlertList({ alerts, showCrew = false, onSelectCrew, scroll = false }) {
  if (!alerts.length) return <p className="empty">Sin alertas activas.</p>;
  return (
    <div className={`alert-list ${scroll ? 'scroll' : ''}`}>
      {alerts.map((a, i) => (
        <article key={`${a.crew_code}-${a.metric_code}-${i}`} className={`alert ${a.level}`}>
          <div className="row">
            <span className="title">{a.problem_name ?? a.metric_name}</span>
            <Badge level={a.level} />
          </div>
          <div className="row small muted">
            <span>
              {showCrew && (a.crew_code ? (
                <button className="back" onClick={() => onSelectCrew?.(a.crew_code)}>{a.crew_code}</button>
              ) : <b>{a.mission_code} · módulo</b>)}
              {showCrew && ' · '}
              {a.metric_name}: <b>{fmt(a.value, 2)} {a.unit}</b> {a.pct_change_from_baseline != null && `(${fmtPct(a.pct_change_from_baseline)} vs línea base)`}
            </span>
          </div>
          <p className="action">{a.action}</p>
          <span className="cm">Contramedida: {a.countermeasure_name}</span>
        </article>
      ))}
    </div>
  );
}
