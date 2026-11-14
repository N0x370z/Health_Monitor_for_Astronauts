import { useState } from 'react';
import { useApi } from '../api.js';
import { AlertList, Badge, Card, Dot, Loading } from '../components/ui.jsx';
import { ROLE_LABEL, VITALS, fmt } from '../format.js';

const REFRESH_MS = 60_000;

export default function CrewOverview({ onSelectCrew }) {
  const [mission, setMission] = useState('');
  const missions = useApi('/api/missions');
  const crew = useApi(`/api/crew${mission ? `?mission=${mission}` : ''}`, REFRESH_MS);
  const alerts = useApi(`/api/alerts${mission ? `?mission=${mission}` : ''}`, REFRESH_MS);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Monitoreo cardiovascular de la tripulación</h1>
          <p>Signos vitales de las últimas 24 h, ecocardiogramas periódicos y dosis de radiación. Cada alerta indica el problema
            cardiovascular que anticipa y la contramedida recomendada.</p>
        </div>
        <Loading state={missions}>
          {(list) => (
            <div className="chips">
              <button className={`chip ${mission === '' ? 'active' : ''}`} onClick={() => setMission('')}>Todas</button>
              {list.map((m) => (
                <button key={m.mission_code} className={`chip ${mission === m.mission_code ? 'active' : ''}`}
                  onClick={() => setMission(m.mission_code)} title={m.name_es}>
                  {m.mission_code.replace('SIM-', '')}
                </button>
              ))}
            </div>
          )}
        </Loading>
      </div>

      <Loading state={crew}>
        {(list) => (
          <div className="kpis">
            <Kpi label="Tripulantes monitoreados" value={list.length} />
            <Kpi label="En riesgo crítico" value={list.filter((c) => c.risk.level === 'critical').length} level="critical" />
            <Kpi label="Requieren atención" value={list.filter((c) => c.risk.level === 'warning').length} level="warning" />
            <Kpi label="Sin alertas" value={list.filter((c) => c.risk.level === 'normal').length} level="normal" />
          </div>
        )}
      </Loading>

      <div className="grid-2">
        <Card title="Tripulación" hint="Ordenada por riesgo · se actualiza cada minuto">
          <Loading state={crew}>
            {(list) => (
              <div className="grid-cards">
                {[...list].sort((a, b) => b.risk.score - a.risk.score).map((c) => (
                  <button key={c.crew_code} className={`card crew-card ${c.risk.level}`} onClick={() => onSelectCrew(c.crew_code)}>
                    <div className="who">
                      <div>
                        <div className="code">{c.crew_code}</div>
                        <div className="small muted">{ROLE_LABEL[c.role] ?? c.role} · {c.mission_name}</div>
                      </div>
                      <Badge level={c.risk.level} />
                    </div>
                    <div className="vitals">
                      {VITALS.map((v) => (
                        <div className="vital" key={v.code}>
                          <div className="l">{v.label}</div>
                          <div className="v"><Dot level={c.vitals[v.code]?.status ?? 'normal'} />{fmt(c.vitals[v.code]?.value, v.digits)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="small muted">
                      {c.risk.alert_count ? `${c.risk.alert_count} alerta(s) · riesgo ${c.risk.score}/100` : 'Sin alertas activas'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Loading>
        </Card>

        <Card title="Alertas activas" hint="Más graves primero">
          <Loading state={alerts}>{(list) => <AlertList alerts={list} showCrew scroll onSelectCrew={onSelectCrew} />}</Loading>
        </Card>
      </div>
    </>
  );
}

function Kpi({ label, value, level }) {
  return (
    <div className="card kpi">
      <div className="label">{level && <Dot level={level} />} {label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
