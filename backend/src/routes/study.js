import { all, get } from '../db.js';
import { HttpError } from '../http.js';

const KEY_METRICS = ['lv_mass', 'stroke_volume', 'lvedv', 'lvot_vti', 'hr_tdi_left', 'e_a_ratio', 'lvef', 'e_e_prime_ratio'];

export function register(router) {
  router.get('/api/study/cft70', () => ({
    study: get('SELECT * FROM study WHERE study_code = ?', 'CFT70'),
    groups: all(`SELECT g.*, COUNT(s.subject_code) AS subjects FROM study_group g
                 LEFT JOIN study_subject s USING (group_code) GROUP BY g.group_code ORDER BY g.group_code`),
    timepoints: all('SELECT * FROM study_timepoint ORDER BY sort_order'),
    key_metrics: all(`SELECT metric_code, name_es, unit, problem_code FROM metric
                      WHERE metric_code IN (${KEY_METRICS.map(() => '?').join(',')})`, ...KEY_METRICS),
    data_quality: all(`SELECT quality_flag, COUNT(*) AS n FROM study_echo_measurement GROUP BY quality_flag`),
  }));

  // Serie de cambio medio (%) vs antes del reposo por grupo, para comparar con la tripulación.
  router.get('/api/study/cft70/effects', (_, query) => {
    const metric = query.get('metric') ?? 'lv_mass';
    if (!get('SELECT 1 FROM metric WHERE metric_code = ?', metric)) throw new HttpError(400, `Métrica no válida: ${metric}`);
    return all(
      `SELECT e.group_code, g.name_es AS group_name, e.timepoint_code, t.day_offset, t.sort_order, t.label_es,
              e.n, e.mean_baseline, e.mean_value, e.mean_pct_change, e.sd_pct_change
       FROM study_effect e JOIN study_timepoint t USING (timepoint_code) JOIN study_group g USING (group_code)
       WHERE e.metric_code = ? AND e.group_code <> 'UNASSIGNED' ORDER BY e.group_code, t.sort_order`, metric);
  });
}
