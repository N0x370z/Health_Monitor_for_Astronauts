import { useApi } from '../api.js';
import { Card, Loading } from '../components/ui.jsx';

const ROLE = { prevention: 'Prevención', treatment: 'Tratamiento', monitoring: 'Vigilancia' };
const PHASE = { in_flight: 'En vuelo', landing: 'Aterrizaje', post_flight: 'Después del vuelo', any: 'Toda la misión' };

export default function ProblemsView() {
  const problems = useApi('/api/problems');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Problemas cardiovasculares del vuelo espacial</h1>
          <p>Qué le pasa al corazón y a la circulación lejos de la gravedad terrestre, qué dicen los datos y cómo se previene.
            Ordenados por gravedad para la misión.</p>
        </div>
      </div>
      <Loading state={problems}>
        {(list) => (
          <div className="grid-charts">
            {list.map((p) => (
              <Card key={p.problem_code} className="problem">
                <div className="card-head" style={{ marginBottom: 0 }}>
                  <h2>{p.name_es}</h2>
                  <span className="rank">#{p.severity_rank} · {PHASE[p.mission_phase]}</span>
                </div>
                <dl>
                  <dt>Por qué ocurre</dt><dd>{p.mechanism_es}</dd>
                  <dt>Qué muestran los datos</dt><dd>{p.evidence_es}</dd>
                  <dt>Riesgo para la misión</dt><dd>{p.consequence_es}</dd>
                  <dt>Cómo se previene o trata</dt>
                  <dd className="tagline">
                    {p.countermeasures.map((c) => (
                      <span key={c.countermeasure_code} className={`tag ${c.role}`} title={c.evidence_es}>
                        {ROLE[c.role]}: {c.name_es}
                      </span>
                    ))}
                  </dd>
                  <dt>Métricas que lo vigilan</dt>
                  <dd className="tagline">{p.metrics.map((m) => <span key={m.metric_code} className="tag">{m.name_es}</span>)}</dd>
                </dl>
                <span className="small muted">{p.evidence_count} hallazgo(s) NASA en la base</span>
              </Card>
            ))}
          </div>
        )}
      </Loading>
    </>
  );
}
