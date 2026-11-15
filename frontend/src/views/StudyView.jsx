import { useState } from 'react';
import { useApi } from '../api.js';
import { StudyChart } from '../components/charts.jsx';
import { Card, Loading } from '../components/ui.jsx';
import { fmt } from '../format.js';

export default function StudyView() {
  const [metric, setMetric] = useState('lv_mass');
  const study = useApi('/api/study/cft70');
  const effects = useApi(`/api/study/cft70/effects?metric=${metric}`);

  return (
    <Loading state={study}>
      {({ study: s, groups, timepoints, key_metrics: metrics, data_quality: quality }) => (
        <>
          <div className="page-head">
            <div>
              <h1>Evidencia: estudio NASA CFT70</h1>
              <p>{s.design_es}</p>
            </div>
            <select value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Métrica">
              {metrics.map((m) => <option key={m.metric_code} value={m.metric_code}>{m.name_es}</option>)}
            </select>
          </div>

          <div className="grid-2">
            <Card title={metrics.find((m) => m.metric_code === metric)?.name_es}
              hint="Cambio medio respecto a 2 días antes del reposo (BR-2)">
              <Loading state={effects}>{(rows) => <StudyChart rows={rows} unitLabel="% vs BR-2" />}</Loading>
              <p className="small muted" style={{ marginTop: 8 }}>
                BR = día de reposo en cama · R+0 = 4 h después de levantarse · R+3 = 3 días después.
              </p>
            </Card>

            <div style={{ display: 'grid', gap: 20 }}>
              <Card title="Grupos">
                <table>
                  <tbody>
                    {groups.filter((g) => g.subjects).map((g) => (
                      <tr key={g.group_code}><td><b>{g.name_es}</b><div className="small muted">{g.description_es}</div></td>
                        <td className="num">{g.subjects} sujetos</td></tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card title="Al día 70 de reposo">
                <Loading state={effects}>
                  {(rows) => (
                    <table>
                      <thead><tr><th>Grupo</th><th className="num">n</th><th className="num">Cambio</th></tr></thead>
                      <tbody>
                        {rows.filter((r) => r.timepoint_code === 'BR70').map((r) => (
                          <tr key={r.group_code}><td>{r.group_name}</td><td className="num">{r.n}</td>
                            <td className="num">{fmt(r.mean_pct_change, 1)} %</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Loading>
              </Card>
              <Card title="Calidad de los datos">
                <p className="small muted">
                  {timepoints.length} momentos de medición · {quality.reduce((a, q) => a + q.n, 0).toLocaleString('es-MX')} valores ·{' '}
                  {quality.filter((q) => q.quality_flag !== 'ok').reduce((a, q) => a + q.n, 0)} sin dato (imagen deficiente,
                  sujeto retirado o faltante).
                </p>
              </Card>
            </div>
          </div>
        </>
      )}
    </Loading>
  );
}
