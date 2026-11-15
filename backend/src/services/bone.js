import { all } from '../db.js';
import { HttpError } from '../http.js';
import { mean, oneSample, round, roundP } from './stats.js';

// Bone densitometry (DXA, NASA MR035G). Loaded once; the database is read-only.
//   1. each visit = mean of its repeated scans; left and right hip are averaged;
//   2. bone loss = % change of BMD from the subject's own PRE visit to the end of bed rest;
//   3. a change is real only if it is larger than the region's least significant change (LSC, ISCD).

export const campaigns = all('SELECT * FROM bone_campaign ORDER BY has_phases DESC, campaign_code');
export const regions = all('SELECT * FROM bone_region ORDER BY sort_order');
export const parameters = all('SELECT * FROM bone_parameter ORDER BY role, parameter');
const regionByCode = new Map(regions.map((r) => [r.region_code, r]));
export const subjects = all('SELECT * FROM bone_subject ORDER BY campaign_code, subject_code');
const subjectByCode = new Map(subjects.map((s) => [s.subject_code, s]));

// subject → region → parameter → visit → { values (one per side), days, phase }
const visits = new Map();
for (const r of all(`SELECT subject_code, region_code, side, visit_code, phase, parameter, value, n_scans, days_from_first_scan
                     FROM v_bone_visit`)) {
  const byRegion = visits.get(r.subject_code) ?? new Map();
  visits.set(r.subject_code, byRegion);
  const byParam = byRegion.get(r.region_code) ?? new Map();
  byRegion.set(r.region_code, byParam);
  const byVisit = byParam.get(r.parameter) ?? new Map();
  byParam.set(r.parameter, byVisit);
  const v = byVisit.get(r.visit_code) ?? { values: [], n_scans: 0, phase: r.phase, days: r.days_from_first_scan };
  v.values.push(r.value);
  v.n_scans += r.n_scans;
  byVisit.set(r.visit_code, v);
}

const VISIT_ORDER = ['PRE', 'BR_MID', 'BR_END', 'R+1', 'R+2', 'R+3', 'R+4', 'R+11', 'FU_6MO', 'FU_1Y', 'FOLLOW_UP'];
const visitRank = (v) => {
  const i = VISIT_ORDER.indexOf(v);
  return i >= 0 ? i : 100 + Number(v.replace(/\D/g, '') || 0);
};
const RECOVERY = ['R+1', 'R+2', 'R+3', 'R+4'];

function visitValue(subject, region, parameter, visit) {
  const v = visits.get(subject)?.get(region)?.get(parameter)?.get(visit);
  return v ? mean(v.values) : null;
}

/** End of bed rest: last in-bed-rest scan (day ≥ 45), else the first recovery scan (≤ 4 days after). */
export function endVisit(subject, region) {
  const byVisit = visits.get(subject)?.get(region)?.get('bmd');
  if (!byVisit) return null;
  if (byVisit.has('BR_END')) return 'BR_END';
  return RECOVERY.find((v) => byVisit.has(v)) ?? null;
}

export function boneLoss(subject, region) {
  const end = endVisit(subject, region);
  const pre = visitValue(subject, region, 'bmd', 'PRE');
  const post = end && visitValue(subject, region, 'bmd', end);
  return pre && post ? { end_visit: end, pct: ((post - pre) / pre) * 100 } : null;
}

const classify = (pct, lsc) => (pct == null || lsc == null ? null : pct <= -lsc ? 'loss' : pct >= lsc ? 'gain' : 'stable');
const zCategory = (z) => (z == null ? null : z <= -2 ? 'below_expected' : 'within_expected');
const tCategory = (t) => (t == null ? null : t <= -2.5 ? 'osteoporosis' : t < -1 ? 'low_bone_mass' : 'normal');

let summaryCache = null;
/** Bone loss by region (campaigns with bed rest phases), ranked by standardized response. */
export function regionSummary() {
  summaryCache ??= (() => {
    const phased = new Set(campaigns.filter((c) => c.has_phases).map((c) => c.campaign_code));
    const rows = regions.map((r) => {
      const losses = subjects.filter((s) => phased.has(s.campaign_code))
        .map((s) => ({ s, l: boneLoss(s.subject_code, r.region_code) })).filter((x) => x.l);
      const pcts = losses.map((x) => x.l.pct);
      const t = oneSample(pcts);
      const byCampaign = Object.fromEntries([...phased].map((c) => {
        const xs = losses.filter((x) => x.s.campaign_code === c).map((x) => x.l.pct);
        return [c, xs.length ? { n: xs.length, mean_pct_change: round(mean(xs), 2) } : null];
      }));
      return {
        region_code: r.region_code,
        name: r.name,
        site: r.site,
        role: r.role,
        weight_bearing: Boolean(r.weight_bearing),
        rationale: r.rationale,
        source_id: r.source_id,
        precision_cv_pct: r.precision_cv_pct,
        lsc_pct: r.lsc_pct,
        n: t.n,
        mean_pct_change: round(t.mean, 2),
        sd_pct_change: round(t.sd, 2),
        ci95_pct_change: t.ci95 && t.ci95.map((x) => round(x, 2)),
        p_vs_baseline: roundP(t.p),
        standardized_response: t.sd ? round(t.mean / t.sd, 2) : null,
        pct_subjects_beyond_lsc: t.n ? Math.round((100 * pcts.filter((x) => x <= -r.lsc_pct).length) / t.n) : null,
        by_campaign: byCampaign,
      };
    });
    const ranking = rows.filter((r) => r.standardized_response != null)
      .sort((a, b) => a.standardized_response - b.standardized_response)
      .map((r, i) => ({ rank: i + 1, region_code: r.region_code, name: r.name, role: r.role, mean_pct_change: r.mean_pct_change,
        standardized_response: r.standardized_response, p_vs_baseline: r.p_vs_baseline }));
    return { regions: rows, ranking };
  })();
  return summaryCache;
}

export function publicSubject(s) {
  return { subject_code: s.subject_code, campaign_code: s.campaign_code, cohort: s.cohort, sex: s.sex };
}

export function findBoneSubject(code) {
  const s = subjectByCode.get(String(code).toUpperCase()) ?? subjectByCode.get(String(code));
  if (!s) throw new HttpError(404, `Bone subject ${code} not found`);
  return s;
}

/** List of subjects with their loss at the key regions. */
export function subjectList(campaign) {
  const keys = regions.filter((r) => r.role === 'key');
  return subjects.filter((s) => !campaign || s.campaign_code === campaign.toUpperCase()).map((s) => {
    const losses = keys.map((r) => ({ r, l: boneLoss(s.subject_code, r.region_code) })).filter((x) => x.l);
    return {
      ...publicSubject(s),
      key_regions_with_loss: losses.filter((x) => classify(x.l.pct, x.r.lsc_pct) === 'loss').map((x) => x.r.region_code),
      total_hip_pct_change: round(boneLoss(s.subject_code, 'TOTAL_HIP')?.pct, 2),
    };
  });
}

/** Timeline of one subject: every region and visit, % change from PRE and status against the LSC. */
export function subjectDetail(s) {
  const byRegion = visits.get(s.subject_code) ?? new Map();
  return {
    subject: { ...publicSubject(s), height_cm: s.height_cm, weight_kg: s.weight_kg },
    campaign: campaigns.find((c) => c.campaign_code === s.campaign_code),
    regions: regions.filter((r) => byRegion.has(r.region_code)).map((r) => {
      const byParam = byRegion.get(r.region_code);
      const bmd = byParam.get('bmd') ?? new Map();
      const pre = visitValue(s.subject_code, r.region_code, 'bmd', 'PRE');
      const loss = boneLoss(s.subject_code, r.region_code);
      const order = [...new Set([...byParam.values()].flatMap((m) => [...m.keys()]))].sort((a, b) => visitRank(a) - visitRank(b));
      return {
        region_code: r.region_code,
        name: r.name,
        role: r.role,
        lsc_pct: r.lsc_pct,
        bed_rest_change: loss && { end_visit: loss.end_visit, pct_change: round(loss.pct, 2), status: classify(loss.pct, r.lsc_pct) },
        visits: order.map((v) => {
          const val = (p) => visitValue(s.subject_code, r.region_code, p, v);
          const b = val('bmd');
          const pct = pre && b != null && v !== 'PRE' ? ((b - pre) / pre) * 100 : null;
          const z = val('z_score');
          const t = val('t_score');
          return {
            visit_code: v,
            phase: (bmd.get(v) ?? [...byParam.values()].find((m) => m.has(v))?.get(v))?.phase ?? null,
            n_scans: bmd.get(v)?.n_scans ?? null,
            bmd: round(b, 3),
            bmc: round(val('bmc'), 2),
            z_score: round(z, 1),
            t_score: round(t, 1),
            pct_change_from_pre: round(pct, 2),
            status: classify(pct, r.lsc_pct),
            z_category: zCategory(z),
            t_category: tCategory(t),
          };
        }),
      };
    }),
  };
}

export function regionInfo(code) {
  return regionByCode.get(code) ?? null;
}
