# Glossary

Terms and abbreviations needed to read the ORBIT CARE web app. Attention / Critical thresholds are the ones used by the frontend (`frontend/src/sim/heart.js`). The database ranges and their sources are in [`DATA_SOURCES.md`](DATA_SOURCES.md) and [`CARDIOVASCULAR_MONITORING.md`](CARDIOVASCULAR_MONITORING.md).

## 1. Study and timeline
| Term | Meaning |
|---|---|
| **CFT70** | NASA 70-day bed rest study that simulates microgravity. |
| **BRSMCF** | NASA dataset that holds the CFT70 echocardiography files. |
| **Head-down tilt bed rest** | Subjects lie for 70 days with the head 6° below the feet. Body fluids shift toward the head, as in space. |
| **Subject** | Study participant, identified by NASA's anonymous code (e.g. 6546). |
| **Crew** | The 7 subjects of a special subset of the study, shown as the "crew" in the app. |
| **Pre** | Measurement 2 days before bed rest. It is each person's **baseline** (BR−2 in the database). |
| **D7, D21, D30, D70** | Bed rest days 7, 21, 30 and 70. D70 is the equivalent of the end of a mission. |
| **R+0** | About 4 hours after getting up, the equivalent of landing. |
| **R+3** | 3 days after the end of bed rest (recovery). |
| **Baseline** | The subject's own Pre value. Every % change is computed against it. |
| **% vs pre / Δ** | How much a value changed from the baseline. Negative means it went down. |

## 2. Groups and countermeasures
| Term | Meaning |
|---|---|
| **Control** | Group with no exercise, bed rest only. Shows the damage without protection. |
| **Exercise A / Exercise B** | Groups with aerobic and resistance exercise (two variants in the study). |
| **Flywheel** | Resistance exercise with a flywheel device (no weights needed, so it works in space). |
| **Countermeasure** | An action that prevents damage: exercise, fluid loading before return, etc. |
| **Fluid loading** | Drinking fluids and salt before return to avoid dizziness when standing up. |
| **n** | Number of subjects in the group. |

## 3. Heart regions (score by chamber)
| Region | What it assesses |
|---|---|
| **Left ventricle** | The chamber that pumps blood to the whole body: size, mass and strength. |
| **Mitral valve** | How the left ventricle fills (diastole). |
| **Aortic outflow** | How much blood leaves per beat and per minute. |
| **Right ventricle** | The chamber that pumps blood to the lungs. |
| **Rate & timing** | Heart rate and efficiency of the cardiac cycle. |
| **Systole / diastole** | Contraction (blood is pushed out) and relaxation (the heart fills). |

## 4. Echocardiography metrics
| Abbreviation | Name | What it shows | Attention / Critical |
|---|---|---|---|
| **LV** | Left ventricle | — | — |
| **RV** | Right ventricle | — | — |
| **LV mass** | Left ventricular mass (g) | Heart muscle. It drops with deconditioning (atrophy). | −8 % / −15 % |
| **LVEDV** | LV end-diastolic volume (mL) | How much blood the full ventricle holds. | −10 % / −20 % |
| **LVESV** | LV end-systolic volume (mL) | Blood left after the contraction. | — |
| **SV** | Stroke volume (mL) | Blood pumped per beat (LVEDV − LVESV). | −15 % / −25 % |
| **EF** | Ejection fraction (%) | % of the blood pumped out in each beat. | < 52 / < 40 |
| **CO** | Cardiac output (L/min) | Blood pumped per minute (SV × HR). | < 3.5 / < 2.5 |
| **HR** | Heart rate (bpm) | Beats per minute. It rises to compensate for a low SV. | > 90 or +20 % / > 110 or +35 % |
| **FS** | Fractional shortening (%) | How much the ventricle shortens when it contracts. | < 28 / < 20 |
| **LVIDd** | LV internal diameter in diastole (cm) | Size of the full ventricle. | −8 % / −15 % |
| **LVOT VTI** | LV outflow tract velocity-time integral (cm) | Distance the blood travels in each beat. The strongest single signal in the study. | < 16 or −20 % / < 12 or −30 % |
| **E / A** | Mitral E and A waves | Early filling (E) and filling from the atrial contraction (A). | — |
| **E/A** | E/A ratio | Ventricular filling pattern. | < 0.8 or > 2.5 / < 0.6 |
| **e′** (e prime) | Mitral annular velocity (TDI) | How fast the muscle relaxes. | — |
| **E/e′** | E/e′ ratio | Estimate of filling pressure. High means a stiffer ventricle. | > 10 / > 14 |
| **DT** | Mitral deceleration time (ms) | Speed of ventricular filling. | > 280 |
| **Tei / MPI** | Tei index, or myocardial performance index | Overall efficiency: (IVCT + IVRT) / ejection time. Higher is worse. | > 0.45 / > 0.6 |
| **RV S′** | Tricuspid annular systolic velocity (cm/s) | Strength of the right ventricle. | < 9.5 / < 8 |
| **LV S′** | Mitral annular systolic velocity (cm/s) | Longitudinal strength of the left ventricle. | < 7 / < 5.5 |
| **RVSP** | Right ventricular systolic pressure (mmHg) | Pressure on the lung side: 4 × (tricuspid regurgitation velocity)² + 3. | > 35 / > 45 |
| **TR** | Tricuspid regurgitation | Small backflow through the tricuspid valve. RVSP is computed from it. | — |
| **IVCT / IVRT** (ICT) | Isovolumic contraction / relaxation time | Components of the Tei index. | — |

## 5. Types of echocardiography
| Term | Meaning |
|---|---|
| **Echo** | Ultrasound of the heart (echocardiogram). |
| **2D** | Flat image. Diameters and FS come from it. |
| **3D echo** | Volume image. Measures mass and volumes more precisely. |
| **Doppler** | Measures the speed of the blood (E, A, VTI, TR). |
| **TDI** (*Tissue Doppler Imaging*) | Doppler of the heart muscle: e′ and S′. |
| **M-mode** | Single line over time, used to measure diameters. |
| **A1, A2, A3** | Anonymous codes of the analysts who read the 3D echo. |

## 6. Status and score
| Term | Meaning |
|---|---|
| **Heart score** | 0 to 100; 100 means no adverse change. Computed by region and overall. |
| **Nominal** | Normal. |
| **Watch** | Mild change; worth monitoring. |
| **Attention** | Out of range or moderate change. |
| **Critical** | Beyond the critical limit or large change. |
| **No data / Error** | No measurement at that timepoint. The app does not invent values. |
| **last value** | The latest available value from an earlier timepoint is shown. |
| **Findings** | Metrics outside normal, with their explanation and the suggested action. |
| **Deconditioning** | Loss of heart capacity from lack of gravity or exercise. |
| **Orthostatic intolerance** | Dizziness or fainting when standing up after returning to gravity. |

## 7. Statistics (Countermeasures screen)
| Term | Meaning |
|---|---|
| **Mean change** | Average % change of the group. |
| **vs Control** | Comparison of an exercise group with the no-exercise group. |
| **Welch t-test** | Test that compares two groups even when their variance or size differ. |
| **p** | Probability of seeing that difference by chance alone. **p < 0.05** is considered significant and is shown in green. |
| **g (Hedges' g)** | Effect size: about 0.2 is small, 0.5 medium, 0.8 or more large. |

## 8. Daily check-in and other terms
| Term | Meaning |
|---|---|
| **Daily check-in** | Daily log of mood, stress, energy, sleep and symptoms. Stored only in the browser. |
| **SANS** | *Spaceflight-Associated Neuro-ocular Syndrome*: vision changes caused by spaceflight. |
| **Amsler grid** | Grid used to detect vision changes. The app suggests it when vision changes are reported. |
| **ECG** | Electrocardiogram. The app suggests it when an irregular rhythm is suspected. |
| **SpO₂** | Blood oxygen saturation. Listed under "Not in database": the app does not measure it. |
| **API / Live / Offline** | Data source. *Live* means the data comes from the database through the API. *Offline* means it comes from the CSV files bundled with the app. |
| **LIVE SIM** | Value simulated every second in the browser (pulse and SpO₂). The pulse starts from the measured heart rate. Not study data. |
| **How it works** | Button that opens the guided tour of the current screen. |
| *Italic value* | In the echo table: value missing in the study at that day, completed from the same database (same subject, group or all subjects). Hover to see from where. |
| **Replay** | Steps automatically through the study timepoints, from Pre to R+3. |

## 9. Bone density (API and `docs/BONE_DENSITY.md`)
| Term | Meaning |
|---|---|
| **DXA** | Dual-energy X-ray absorptiometry: low-dose X-ray scan that measures bone mineral. |
| **BMD** | Bone mineral density (g/cm²). The main value to follow. |
| **BMC** | Bone mineral content (g): grams of mineral in the region. |
| **T-score** | BMD compared with young adults, in SD. WHO: ≥ −1.0 normal, −1.0 to −2.5 low bone mass, ≤ −2.5 osteoporosis (for postmenopausal women and men 50+). |
| **Z-score** | BMD compared with people of the same age and sex, in SD. In young adults, ≤ −2.0 is below the expected range. |
| **Precision (CV %)** | Scanner error, measured from repeated scans of the same person on the same day. |
| **LSC** | Least significant change = 2.77 × precision. A smaller change cannot be told apart from scanner error. |
| **Loss / stable / gain** | Change from PRE larger than the LSC downward, within the LSC, or larger than the LSC upward. |
| **Standardized response** | Mean change divided by its SD. More negative means a larger and more consistent loss. |
| **Total hip, femoral neck, trochanter, intertrochanteric** | Regions of the upper femur measured in a hip scan. |
| **Calcaneus** | Heel bone. |
| **Lumbar spine L1–L4** | The four lower back vertebrae, measured together. |
| **Forearm 1/3** | Shaft of the radius and ulna at one third of the forearm length. Used here as a control. |
| **Weight-bearing** | Bone that carries body weight when standing (hip, pelvis, legs, heel, spine). It loses bone without gravity. |
| **Key / supporting / control region** | Key: best structures to detect bone loss. Supporting: clinical or global reference. Control: non-weight-bearing, should not change. |
| **PRE, BR_MID, BR_END, R+n, FU_6MO, FU_1Y** | Bone visits: before bed rest, mid bed rest, end of bed rest, n days after, follow-up at 6 months and 1 year. |
| **UTMB, MEDES** | Bed rest facilities: University of Texas Medical Branch (USA) and the French Institute for Space Medicine and Physiology (Toulouse). |
