import { all, get } from '../db.js';
import { HttpError } from '../http.js';
import { subjectAlerts } from '../services/assessment.js';
import { findTimepoint, regions, subjects } from '../services/dataset.js';

export function register(router) {
  // Alertas de todos los sujetos en un momento del estudio, de la más grave a la menos grave.
  router.get('/api/alerts', (_, query) => {
    const tp = findTimepoint(query.get('timepoint')).timepoint_code;
    const level = query.get('level');
    const group = query.get('group')?.toUpperCase();
    return subjects
      .filter((s) => !group || s.group_code === group)
      .flatMap((s) => subjectAlerts(s.subject_code, tp).map((a) => ({ ...a, group_code: s.group_code })))
      .filter((a) => !level || a.level === level)
      .sort((a, b) => (b.level === 'critical') - (a.level === 'critical') || b.severity - a.severity);
  });

  router.get('/api/problems', () => {
    const problems = all('SELECT * FROM cv_problem ORDER BY severity_rank, problem_code');
    const cms = all(`SELECT pc.problem_code, pc.role, c.* FROM problem_countermeasure pc
                     JOIN countermeasure c USING (countermeasure_code)`);
    const metrics = all('SELECT metric_code, name_es, unit, category, problem_code FROM metric');
    const evidence = Object.fromEntries(
      all('SELECT problem_code, COUNT(*) AS n FROM nasa_evidence_finding GROUP BY problem_code').map((r) => [r.problem_code, r.n]));
    return problems.map((p) => ({
      ...p,
      countermeasures: cms.filter((c) => c.problem_code === p.problem_code),
      metrics: metrics.filter((m) => m.problem_code === p.problem_code),
      evidence_count: evidence[p.problem_code] ?? 0,
    }));
  });

  router.get('/api/problems/:code', ({ code }) => {
    const problem = get('SELECT * FROM cv_problem WHERE problem_code = ?', code);
    if (!problem) throw new HttpError(404, `Problema ${code} no encontrado`);
    return {
      ...problem,
      source: get('SELECT * FROM source WHERE source_id = ?', problem.source_id),
      rules: all(`SELECT r.*, c.name_es AS countermeasure_name FROM alert_rule r
                  LEFT JOIN countermeasure c USING (countermeasure_code) WHERE r.problem_code = ? ORDER BY r.rule_id`, code),
      countermeasures: all(`SELECT pc.role, c.* FROM problem_countermeasure pc JOIN countermeasure c USING (countermeasure_code)
                            WHERE pc.problem_code = ?`, code),
      evidence: all(`SELECT experiment_id, experiment_title, finding_text, is_quantitative, species
                     FROM v_problem_evidence WHERE problem_code = ? ORDER BY is_quantitative DESC LIMIT 25`, code),
    };
  });

  router.get('/api/reference', () => ({
    metrics: all('SELECT * FROM metric ORDER BY category, metric_code'),
    ranges: all(`SELECT r.*, s.citation FROM medical_reference r JOIN source s ON s.source_id = r.primary_source_id
                 ORDER BY r.metric_code, r.context`),
    change_thresholds: all('SELECT * FROM change_threshold'),
    regions,
    countermeasures: all('SELECT * FROM countermeasure'),
    sources: all('SELECT * FROM source ORDER BY source_type, source_id'),
  }));
}
