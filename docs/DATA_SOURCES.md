# Data Sources and Citations

Every source used to build `data/health_monitor.sqlite`. The same list, with the exact value of each threshold, is stored in the database tables `source`, `medical_reference`, `change_threshold` and `alert_rule`.

**Scope:** cardiovascular problems caused by spaceflight, measured on real NASA data, plus the reference ranges for blood pressure, orthostatic tests and radiation that frame them.

---

## 1. Declarations

1. **Real data.**
   - The `study_*` tables contain real, public echocardiography data from NASA (section 2).
   - The `nasa_*` tables contain public NASA metadata and published results (section 3).
2. **No synthetic data (since v4).** The synthetic crew tables used until v3 (`mission`, `crew_member`, `measurement`, `daily_measurement`, `event`) were removed. Derived metrics (cardiac output, Tei index, RV systolic pressure, average E/e′, stroke volume, ejection fraction, ratios) are computed from the real measurements with the formula stored in `study_echo_measurement.comment`.
3. **No personal data.**
   - Study subjects keep only NASA's anonymous numeric codes (`S5210`).
   - The 3D echo file names the image analysts; they were replaced by codes (`A1`, `A2`, `A3`).
4. **Project heuristics.** Thresholds with source `SRC_PROJECT` are design choices, not validated clinical values. This includes the change-from-baseline thresholds (derived from CFT70 group means), the heart-region weights and the score bands.
5. **Not a medical device.** Educational hackathon prototype.

---

## 2. Real echocardiography data: NASA CFT70 / BRSMCF

| Item | Detail |
|---|---|
| Study | NASA 70-day Bed Rest Study (CFT70). Bed Rest Standard Measures: Cardiovascular Function (BRSMCF) |
| Design reference | Cromwell RL, Scott JM, Downs M, Yarbough PO, Zanello SB, Ploutz-Snyder L. Overview of the NASA 70-day Bed Rest Study. *Med Sci Sports Exerc.* 2018;50(9):1909–1919. https://doi.org/10.1249/MSS.0000000000001617 |
| Archive | NASA Life Sciences Data Archive (LSDA), experiment `BRSMCF`, "Data preservation is complete. All datasets are publicly available." Portal: https://nlsp.nasa.gov/explore/data |
| Files imported | `BRSMCF CFT70 Echo All Data 2.csv` (184 rows, 37 subjects, 27 2D/Doppler/TDI variables) · `BRSMCF CFT70 3D Echo Data 2.csv` (510 rows, 37 subjects, LV mass/LVEDV/LVESV, two readings per study) · `BRSMCF CFT70 Echo 7 Subjects.csv` and `… 7 Subjects 3.csv` (35 rows each) |
| Stored in | `study`, `study_group`, `study_subject`, `study_timepoint`, `study_echo_measurement` (7,890 imported values + 863 derived in v4). Group summaries are computed by the backend |

### Notes on the import
- The two "7 Subjects" files are **byte-identical**. They are a subset of `Echo All Data 2` and match it, except for one value: subject 9667, day 7, LV systolic diameter is `0.0` in the subset and missing in All Data. It is stored as missing (`quality_flag = zero_as_missing`).
- The 3D column `LVSV` is the **end-systolic volume**, not the stroke volume: about 46 mL against an end-diastolic volume of about 137 mL. Stroke volume (LVEDV − LVESV) and ejection fraction were derived from it.
- Units are not stated in the files. They were inferred from the value ranges and recorded in `metric.unit_note`: cm, cm/s, ms, bpm, g, mL.
- Timepoint labels were normalized: `2` → BR-2, `0 +4 hr`/`0 +4 hrs`/`0 +4hr` → R+0, `3` → R+3.
- Comments such as "bad images", "Dismissed early" or "Qlab software not compatible" are kept as `quality_flag` (bad_image, dismissed, not_analyzable).
- Subject 5159 appears only in the 3D file and has no group (`UNASSIGNED`). Subject 6611 appears only in the 2D file.

---

## 3. NASA Life Sciences Data Archive (evidence)

| Item | Detail |
|---|---|
| Starting file | `by_topic` CSV export of the LSDA dataset catalog (13 files) |
| Records | `GET https://nlsp.nasa.gov/api/v1/data/lsda_dataset/{id}` and `GET https://nlsp.nasa.gov/api/v1/data/experiments?page=1&limit=10000`. Accessed 14 November 2026 |
| Stored | `nasa_dataset` (829 cardiovascular-related datasets), `nasa_experiment` (158), `nasa_evidence_finding` (241 result sentences linked to a cardiovascular problem) |

LSDA studies used directly:

| Source ID | Study | Used for |
|---|---|---|
| `LSDA_DSO402` | DSO 402 Cardiovascular Deconditioning Countermeasure Assessment | Heart rate and blood pressure |
| `LSDA_DSO603` | DSO 603 Orthostatic Function During Entry, Landing, and Egress (about 20 % at their cardiovascular limit) | Orthostatic intolerance |
| `LSDA_DOSIMETRY` | DSO 200 / Mir 18 dosimetry | Radiation spikes |
| `LSDA_KENTAVR` | ROI_KENTAVR (0 % presyncope with a compression garment) | Compression garment |
| `LSDA_MIDODRINE` | DSO 503S / SMO 006 Midodrine as a Countermeasure Against Postflight Orthostatic Hypotension | Midodrine |
| `LSDA_DSO623` | DSO 623 In-flight LBNP Test of Countermeasures (LBNP + isotonic saline before landing) | Fluid loading |

**How to cite an LSDA record:** NASA Life Sciences Data Archive. *[Dataset or experiment title]*. NASA Life Sciences Portal. [nlsp_url]. Accessed 14 November 2026.

---

## 4. Clinical and scientific references

| Source ID | Reference | Used for |
|---|---|---|
| `SRC_PERHONEN` | Perhonen MA et al. Cardiac atrophy after bed rest and spaceflight. *J Appl Physiol.* 2001;91(2):645–653. https://doi.org/10.1152/jappl.2001.91.2.645 | Cardiac atrophy |
| `SRC_ASE_CHAMBER` | Lang RM et al. Recommendations for Cardiac Chamber Quantification by Echocardiography in Adults. *J Am Soc Echocardiogr.* 2015;28(1):1–39.e14. https://doi.org/10.1016/j.echo.2014.10.003 | LV ejection fraction 52–72 %, RV S′ ≥ 9.5 cm/s |
| `SRC_ASE_DIASTOLIC` | Nagueh SF et al. Recommendations for the Evaluation of Left Ventricular Diastolic Function by Echocardiography. *J Am Soc Echocardiogr.* 2016;29(4):277–314. https://doi.org/10.1016/j.echo.2016.01.011 | e′, average E/e′ > 14, TR velocity > 2.8 m/s, diastolic function algorithm |
| `SRC_RUDSKI` | Rudski LG et al. Guidelines for the Echocardiographic Assessment of the Right Heart in Adults. *J Am Soc Echocardiogr.* 2010;23(7):685–713. https://doi.org/10.1016/j.echo.2010.05.010 | RVSP = 4v² + RAP, RAP 3 mmHg, RVSP ≤ 35 mmHg |
| `SRC_NEWS2` | Royal College of Physicians. *National Early Warning Score (NEWS) 2.* 2017. https://www.rcp.ac.uk/resources/national-early-warning-score-news-2/ | Heart rate and systolic limits |
| `SRC_AHA_BP` | Whelton PK et al. 2017 ACC/AHA/AAPA/ABC/ACPM/AGS/APhA/ASH/ASPC/NMA/PCNA Guideline … High Blood Pressure in Adults. *Hypertension.* 2018;71(6):e13–e115. https://doi.org/10.1161/HYP.0000000000000065 | Blood pressure categories |
| `SRC_ORTHO` | Freeman R et al. Consensus statement on the definition of orthostatic hypotension, neurally mediated syncope and the postural tachycardia syndrome. *Clin Auton Res.* 2011;21:69–72. https://doi.org/10.1007/s10286-011-0119-5 | Orthostatic tests |
| `SRC_ACSM` | American College of Sports Medicine. *ACSM's Guidelines for Exercise Testing and Prescription.* | Blood pressure during exercise |
| `SRC_NASA_STD3001` | NASA-STD-3001, Vol. 1 Rev. C: [V1 4030] career limit, [V1 4031] solar particle events, Table 4.8-1 circulatory system limits (250 / 500 / 1000 mGy-Eq). https://standards.nasa.gov/standard/NASA/NASA-STD-3001_VOL_1 | Radiation limits |
| `SRC_MSL_RAD` | Zeitlin C et al. *Science.* 2013;340(6136):1080–1084. https://doi.org/10.1126/science.1235989 | Mars transit dose rate (1.84 mSv/day) |
| `SRC_LND_MOON` | Zhang S et al. *Sci Adv.* 2020;6(39):eaaz1334. https://doi.org/10.1126/sciadv.aaz1334 | Lunar surface dose rate (1369 µSv/day) |
| `SRC_NASA_ISS_DOSE` | NASA. *Space Faring: The Radiation Challenge.* https://www.nasa.gov/wp-content/uploads/2017/04/radiationchallenge.pdf | ISS dose (80–160 mSv per 6 months) |
| `SRC_UNSCEAR` | UNSCEAR 2008 Report, Vol. I. https://www.unscear.org/unscear/en/publications/2008_1.html | Natural background (2.4 mSv/year) |

### Statistical methods

| Source ID | Reference | Used for |
|---|---|---|
| `SRC_SHROUT_FLEISS` | Shrout PE, Fleiss JL. Intraclass correlations: uses in assessing rater reliability. *Psychol Bull.* 1979;86(2):420–428. https://doi.org/10.1037/0033-2909.86.2.420 | ICC(2,1) between 3D analysts |
| `SRC_WEIR` | Weir JP. Quantifying test-retest reliability using the intraclass correlation coefficient and the SEM. *J Strength Cond Res.* 2005;19(1):231–240. https://doi.org/10.1519/15184.1 | SEM and minimum detectable change (MDC95) |
| `SRC_BLAND_ALTMAN` | Bland JM, Altman DG. Statistical methods for assessing agreement between two methods of clinical measurement. *Lancet.* 1986;327(8476):307–310. https://doi.org/10.1016/S0140-6736(86)90837-8 | Bias and limits of agreement |
| `SRC_HEDGES` | Hedges LV. Distribution theory for Glass's estimator of effect size and related estimators. *J Educ Stat.* 1981;6(2):107–128. https://doi.org/10.3102/10769986006002107 | Effect size of each countermeasure vs Control |

Standard methods without a stored source: Welch's t-test, Pearson and Spearman correlation, Benjamini-Hochberg correction, k-means++ clustering and silhouette.

## 5. Verification

- All DOIs were checked in Crossref and PubMed on 14 November 2026, including the four added in this version: Cromwell 2018, Lang 2015, Nagueh 2016 and Perhonen 2001.
- The NASA-STD-3001 limits were read in the text of the standard.
- The five DOIs added in v4 (Rudski 2010, Shrout and Fleiss 1979, Weir 2005, Bland and Altman 1986, Hedges 1981) were checked in Crossref on 15 November 2026.
- The CFT70 group results computed by the backend match an independent SQL computation (`data/queries.sql` #2) and the analysis in `docs/CARDIOVASCULAR_MONITORING.md`.
