import { HttpError } from '../http.js';
import {
  campaigns, findBoneSubject, parameters, regionSummary, subjectDetail, subjectList, subjects,
} from '../services/bone.js';

const METHOD = 'Each visit is the mean of its repeated DXA scans (left and right hip averaged). Bone loss = % change of BMD ' +
  'from the subject\'s PRE visit to the end of bed rest (last scan on bed rest day 45 or later, else the first scan 1-4 days after). ' +
  'Only campaigns whose files label the bed rest phases are used. Precision = RMS-SD of repeated PRE scans (Glüer 1995); ' +
  'least significant change LSC = 2.77 x precision (ISCD). Ranking by standardized response (mean / SD of the % change).';

export function register(router) {
  // Bone densitometry: campaigns, parameters, regions with their bone loss and the ranking of the most affected regions.
  router.get('/api/bone', () => ({
    dataset: 'NASA MR035G DXA (bone densitometry)',
    method: METHOD,
    campaigns: campaigns.map((c) => ({ ...c, subjects: subjects.filter((s) => s.campaign_code === c.campaign_code).length })),
    parameters,
    ...regionSummary(),
  }));

  router.get('/api/bone/subjects', (_, query) => {
    const campaign = query.get('campaign');
    if (campaign && !campaigns.some((c) => c.campaign_code === campaign.toUpperCase())) {
      throw new HttpError(400, `Unknown campaign: ${campaign}. Use ${campaigns.map((c) => c.campaign_code).join(', ')}`);
    }
    return subjectList(campaign);
  });

  router.get('/api/bone/subjects/:code', ({ code }) => subjectDetail(findBoneSubject(code)));
}
