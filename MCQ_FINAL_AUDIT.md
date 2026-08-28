# Final MCQ Bank Audit

Date: 2026-08-27

Approval: 2026-08-28

Status: **APPROVED FOR PUBLICATION** — the cumulative audit was approved after local validation.

## Frozen authorities

The audit used the repositories in the requested precedence order:

1. `orestispsom/Psychiatry-Exams` at `53420e099d00960a72062842388fd39309609da1` — primary authority for Greek psychiatric terminology, source hierarchy, and the newest audited oral-board writing conventions.
2. `orestispsom/btb-production` at `4eea4d20ebf373468826dc0fa3dc313b856025f7` — secondary authority for clear clinical and psychoeducational prose.
3. `orestispsom/Psych` at baseline `f5fe2f846b237f7e4ff4812cee6b59d3e9984e87` — the bank and implementation under audit.

When conventions differed, the newest audited `Psychiatry-Exams` material controlled.

## Scope and result

- Canonical bank: `src/data/questions.js`
- Questions: **1,843**
- Topics: **21**
- ID span: **1–3000** (IDs are intentionally sparse)
- Final quality state: **1,843 `good`; 0 `unchecked`**
- Source-provenance labels: **1,138 `exact`; 631 `near_exact`; 74 `fabricated`**
- Final bank SHA-256: `efd75198b0dc2a1f9ffffb3fcf943abce76581c35f35c93332bcb5829da78ab0`
- Strict validator result: **0 structural errors; 0 editorial findings**

The 292 questions that entered this pass as `unchecked` were individually adjudicated. In total, 303 question objects changed: those 292 plus 11 items that had already been labelled `good` but still needed correction. The whole bank was also scanned for structural defects, duplicate stems/options, invalid keys, composite answer choices, empty lead-ins, encoding defects, answer-key metadiscourse, and terminology problems. High-risk clinical, legal, numerical, pregnancy, suicide, and drug-safety items received targeted source checks and rewording where needed.

This result does **not** mean that every factual sentence in all 1,843 items was independently re-derived from primary literature during this single pass. Existing `good` items retained the benefit—and limitations—of earlier audits. `sourceStatus` describes provenance fidelity, not an independent guarantee of factual truth.

## Material corrections

The final pass did more than translate surface wording. It repaired single-best-answer validity and safety-sensitive content, including:

- suicide assessment and immediate safety planning;
- clozapine indications, monitoring, breastfeeding, and the carbamazepine interaction;
- lithium use, monitoring, dose adjustment, and long-term bipolar prophylaxis;
- delirium recognition and treatment priorities;
- diagnostic criteria for bulimia nervosa and premature ejaculation;
- pregnancy-related ECT wording;
- antiepileptic psychiatric adverse effects;
- antipsychotic treatment in HIV and interaction-aware titration;
- alcohol-withdrawal vignettes and benzodiazepine treatment;
- STAR*D first-step versus cumulative remission;
- estrogen-containing contraceptive interactions with lamotrigine;
- non-stigmatising violence-risk formulation;
- removal of brittle or misleading incidence/mortality claims;
- replacement of all/none-of-the-above and mixed-domain distractors.

Representative substantially reworked items include IDs 25, 33, 59, 70, 71, 92, 101, 112, 117, 126, 133, 158, 194, 250, 258, 277, 297, 306, 311, 315, 328, 347, 367, 373, 398, 409, 452, 496, 501, 513, 527, 540, 585, 588, 659, 665, 687, 688, 692, 712, 715, 724, 726, 730, 737, 738, 739, 741, 743, 745, 747, 749, 750, 757, 803, 811, 815, 819, 823, 834, 848, 850, 862, 900, 1075, 1132, 1141, 1379, 1547, 1651, 1700, 1730, 1748, 1792, 1835, 1946, 1991, 2346, 2533, 2571, 2588, 2605, 2615, 2833, 2885, 2886, 2894, and 2898.

## Writing and translation gate

Greek is now the learner-facing default. English is retained only where it materially improves recognition, normally after the Greek term on first use. Explanations were edited to remove answer-key narration such as “εξεταστικά” and to state the clinical distinction directly. Acronyms, register, person-first language, and psychiatric terminology follow the primary repository’s glossary and Translation Guide.

Several terms remain legitimate house-style decisions rather than correctness blockers: `contingency management`, `uncompetitive antagonist`, `lead-pipe rigidity`, `token economy`, `rapid tranquillisation`, `trait/state`, and `depot`. They should be standardised globally only after a glossary decision, not rewritten item by item without one.

## Automated gate

`tools/audit-mcq-bank.mjs` now enforces:

- parseable bank structure and unique integer IDs;
- required text fields and exactly five non-empty, distinct options;
- valid answer indices and allowed metadata values;
- no remaining `unchecked` items in strict mode;
- no duplicate normalized stems;
- no all/none-of-the-above variants;
- no empty generic lead-ins, replacement characters, duplicate object fields, or editorial metadiscourse.

Commands:

```text
npm run audit:mcq
npm run audit:mcq:strict
```

Final local validation against the audited tree:

- `npm run audit:mcq:strict` — passed; 0 structural errors and 0 editorial findings.
- `npm test` — passed after integration with current `origin/main`; 2 test files and 10 tests.
- `npm run build` — passed with Vite's existing large-chunk and mixed static/dynamic import warnings.
- `git diff --check` — passed.

`npm ci` reported three high-severity dependency advisories. They were not changed automatically because dependency remediation is outside this content audit and could alter the application dependency graph.

## External checks used for unstable or high-risk claims

- NICE NG222: depression, suicide-risk assessment, further-line treatment, and lithium monitoring — <https://www.nice.org.uk/guidance/ng222/chapter/Recommendations>
- NICE CG178: CBT and family intervention in psychosis/schizophrenia — <https://www.nice.org.uk/guidance/cg178/chapter/Recommendations>
- FDA citalopram label: dose-related safety limitation — <https://www.accessdata.fda.gov/drugsatfda_docs/label/2023/215428s002lbl.pdf>
- AASM restless legs syndrome guideline: current position on routine pramipexole use — <https://aasm.org/wp-content/uploads/2024/03/Treatment-of-RLS-and-PLMD-CPG.pdf>
- Greek Law 2071/1992: statutory mental-health provisions — <https://www.e-nomothesia.gr/inner.php/kat-ygeia/n-2071-1992.html%3Fprint%3D1>
- WHO suicide data and Greece profile — <https://data.who.int/dashboards/ucn/overview> and <https://www.who.int/data/gho/data/countries/country-details/GHO/greece?countryProfileId=755737fb-b3e4-782c-cb3d-401434b6989f>

## Known limitations and next decision

Topic coverage is uneven: psychopharmacology has 324 questions, whereas psychiatry of older adults has 11 and catatonia/movement disorders has 14. That is a blueprint/design limitation, not a defect that could safely be corrected by inventing questions during a final audit.

Before publication, review the cumulative diff with particular attention to the safety-sensitive items above and the remaining house-style terms. If approved, rerun the strict audit, tests, and production build against the exact reviewed tree; then commit only the audit changes, push without rewriting history, and verify GitHub and Vercel production status.
