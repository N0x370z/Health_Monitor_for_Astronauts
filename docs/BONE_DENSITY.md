# Bone Density (DXA): Data and Analysis

How the NASA bone densitometry files were ordered into the project database, and which parameters and skeletal structures matter most to assess bone loss.

> Educational prototype, not a medical device. Terms: [`GLOSSARY.md`](GLOSSARY.md) (section 9).

## 1. Data

| Item | Detail |
|---|---|
| Source | NASA Life Sciences Data Archive, Bone Densitometry Assessment **MR035G** (source `LSDA_MR035G`) |
| Files | 1,064 Hologic DXA exports (`MR035G_1794760364325`) |
| Campaigns | UTMB bed rest Campaign 3 (32 subjects, cohorts C3A–C3H), MEDES bed rest (24 women), UTMB Campaign 1 (3), UTMB artificial gravity pilot (15) |
| Sites | Hip (left and right), lumbar spine, forearm, heel, whole body |
| Kept in the database | 74 subjects, 19,727 measurements, 11 regions, 4 parameters |

### What was kept and what was removed
- **Kept:** BMD, BMC, T-score and Z-score of 11 regions; sex, height and weight at the first scan; bed rest phase and day; repeated-scan index.
- **Removed (personal or not useful for bone loss):**
  - a last-name column, birth dates, ethnicity, menopause year;
  - scanner keys and absolute dates (only the day relative to the first scan is stored);
  - body composition (fat and lean mass);
  - Ward's triangle (not used clinically);
  - single vertebrae (L1–L4 total is kept);
  - forearm subregions other than the 1/3 radius + ulna;
  - empty subregion files (`SR_Bone`);
  - the artificial gravity screening scans (eligibility screening, outside the study timeline).
- **De-duplicated:** the same scan appears in the "All" file of a cohort, in the subject's own file and in the summary file. 38,493 rows → 19,727 unique (key: subject, region, side, parameter, scan ID).
- **Quality flag:** scans between 2006-06-09 and 2006-08-10 are marked `scanner_corrected`. The NASA ReadMe files say the X-ray tube was replaced in that period and those values were corrected (BMD × 1.0120).

### Tables
| Table | Rows | Content |
|---|---|---|
| `bone_campaign` | 4 | Campaign, design, whether the files label the bed rest phases |
| `bone_subject` | 74 | Anonymous code (`C3-224`, `MEDES-A1`…), campaign, cohort, sex, height, weight |
| `bone_region` | 11 | Region, site, weight-bearing, **role** (key / supporting / control), rationale, source, **precision and LSC** |
| `bone_parameter` | 4 | BMD, Z-score, T-score, BMC: role and how to read them |
| `bone_measurement` | 19,727 | One row per scan, region, side and parameter, with visit (PRE, BR_MID, BR_END, R+n, FU_6MO, FU_1Y; V1, V2… when the files have no phase) |
| `v_bone_visit` (view) | — | Mean of the repeated scans of each visit |

## 2. Method

1. **Visit value:** mean of the repeated scans of the visit (usually 3). Left and right hip are averaged.
2. **Bone loss:** % change of BMD from the PRE visit to the end of bed rest.
   - **Campaign 3:** the end is the last in-bed-rest scan (day 45–66), or the first recovery scan (1–4 days after) when there is none.
   - **MEDES:** the end is the R+3 scan.
   - Campaign 1 and the AG pilot are not used, because their files do not label the phases.
3. **Measurement error:** precision = root-mean-square SD of the repeated PRE scans as % of the mean (Glüer 1995). Least significant change: **LSC = 2.77 × precision** (ISCD, Baim 2005). A change smaller than the LSC cannot be told apart from scanner error.
4. **Statistics:** mean change with 95 % CI and t-test against 0, standardized response (mean / SD), and % of subjects whose loss exceeds the LSC. Regions are ranked by standardized response.

## 3. Results (n = 51 subjects, 27 Campaign 3 + 24 MEDES)

| Rank | Region | Role | Mean change | Standardized response | p | LSC | Subjects beyond LSC |
|---|---|---|---|---|---|---|---|
| 1 | Total hip | key | −2.76 % | −1.94 | < 0.001 | 2.30 % | 63 % |
| 2 | Intertrochanteric | key | −3.02 % | −1.75 | < 0.001 | 3.29 % | 45 % |
| 3 | Greater trochanter | key | −2.64 % | −1.36 | < 0.001 | 3.44 % | 27 % |
| 4 | Pelvis | key | −2.12 % | −0.97 | < 0.001 | 4.38 % | 10 % |
| 5 | Calcaneus (Campaign 3 only, n = 27) | key | −1.78 % | −0.51 | 0.014 | 2.95 % | 30 % |
| 6 | Femoral neck | key | −0.93 % | −0.50 | < 0.001 | 3.40 % | 10 % |
| 7 | Legs | supporting | −0.78 % | −0.42 | 0.005 | 5.61 % | 0 % |
| 8 | Whole body | supporting | −0.20 % | −0.19 | 0.20 | 2.53 % | 2 % |
| 9 | Lumbar spine L1–L4 | supporting | +0.02 % | 0.01 | 0.94 | 2.49 % | 16 % |
| 10 | Forearm 1/3 | control | +0.16 % | 0.10 | 0.46 | 3.03 % | 4 % |
| 11 | Arms | control | +0.41 % | 0.17 | 0.25 | 5.97 % | 2 % |

Live values: `GET /api/bone`. Query: `data/queries.sql` (queries 9 and 10).

### Most significant structures for assessing bone loss
1. **Hip: total hip, intertrochanteric region and trochanter.** These have the largest and most consistent losses. The total hip has the best ratio of signal to error (63 % of subjects lose more than the LSC). Spaceflight shows the same pattern (Lang 2004).
2. **Pelvis and calcaneus (heel).** Both are weight-bearing and show significant losses. The heel varies the most between subjects.
3. **Femoral neck.** Its loss is small in bed rest, but it is the WHO diagnostic site and the best predictor of hip fracture, so it stays as a key region.
4. **Lumbar spine.** No mean change in bed rest. It is kept because it is a standard clinical site, and spaceflight losses there are larger than in bed rest.
5. **Controls: forearm and arms.** They do not carry weight and do not change. A loss here would point to a systemic cause, not to unloading.

### Most relevant parameters
| Parameter | Role | How to read it |
|---|---|---|
| **BMD** (g/cm²) | primary | % change from the subject's own PRE value, compared with the region's LSC |
| **Z-score** | primary | Same age and sex. For young adults (all these subjects): Z ≤ −2.0 means below the expected range (ISCD 2013) |
| T-score | supporting | WHO categories (normal ≥ −1.0; low bone mass −1.0 to −2.5; osteoporosis ≤ −2.5). Defined for postmenopausal women and men 50+ (Kanis 1994) |
| BMC (g) | supporting | Confirms that a BMD change is not caused by a different scanned area |

## 4. Limitations
- About 60 days of bed rest is an analog of spaceflight, not spaceflight. Losses in space are larger (about 1–1.5 % per month at the hip; Lang 2004).
- The cohorts of Campaign 3 may include countermeasure groups. The files only give the cohort code (C3A–C3H), so groups are not compared.
- MEDES has no heel scans and only the left hip. Its end point is R+3, not a scan inside bed rest.
- The precision comes from repeated scans on the same day, so it is a lower bound of the real error (repositioning only).
- Campaign 1 and the AG pilot are stored, but they are not used in the analysis because their phases are unknown.

## 5. API
| Endpoint | Description |
|---|---|
| `/api/bone` | Campaigns, parameters, regions with bone loss statistics and the ranking |
| `/api/bone/subjects?campaign=` | Subjects with the key regions that lost more than the LSC |
| `/api/bone/subjects/:code` | One subject: each region and visit with BMD, BMC, scores, % change from PRE and status (loss / stable / gain) |
