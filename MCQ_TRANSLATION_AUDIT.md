# Greek MCQ Translation Audit

## Status and authority

- Audit date: 2026-08-26
- Translation authority: `orestispsom/Psychiatry-Exams`, branch `greek-v5-scale`
- Authority commit: `53420e099d00960a72062842388fd39309609da1`
- Authority file: `oral/100-crucial-questions/internal/translation/Translation-guide-v4.md`
- Authority file SHA-256: `7D284DA9B8387BCE99E990C867B668DC8AD8298D474A7A9E2EA6EB68611B0660`
- Psych baseline: `40d6e115a8519fa2dbef4bd94efaa76a8e120a78` (`origin/main` at audit start)

The available repository information was sufficient to audit and safely edit the Greek MCQ language. Translation Guide v4 was used as a language authority only; psychiatric facts, answer keys, criteria, doses, recommendations, and exam logic were not revised.

## Corpus reconnaissance

The app lazily imports the canonical single-best-answer bank from `src/data/questions.js`. The same objects contain the stems, answer options, correct-answer indexes, explanations, source metadata, and topic labels.

The complete Greek audit corpus was:

- `src/data/questions.js`: 1,843 Greek MCQs;
- `src/data/mcqVignettes.js`: 107 Greek questions in 20 populated clinical-scenario containers;
- total: 1,950 Greek MCQs.

Related datasets inspected but excluded from the Greek translation count:

- `src/data/mcqMatching.js`: 54 matching sets / 271 items, overwhelmingly English source material;
- `src/data/dsm5trSelfExamQuestions.js`: 473 English self-exam questions;
- root `questions.js`: 1,899-question stale, unreferenced duplicate. It is neither imported by the app nor read by the MCQ feedback script and differs in IDs/content from the canonical bank. It was not edited.

The application, search index, and `scripts/mcq-feedback-review.js` all load `src/data/questions.js`. No generator for the canonical bank was found. No current MCQ-specific test script or pre-existing translation validator was found; repository-level validation is provided by the production build.

## Audit method

Every Greek stem, option, explanation, topic label, vignette title, and vignette body was included in corpus-wide scans for:

- Translation Guide v4 rejected/superseded forms and terminology families;
- psychiatric, psychopharmacological, neuroanatomical, addiction, sleep, risk, and assessment terminology;
- untranslated English and hybrid English/Greek phrases;
- construct-collapsing terms in psychopathology;
- modality, causal-strength, and recommendation-strength warning language;
- duplicated calques and unnatural generated scaffolding.

Each candidate was then reviewed in its complete MCQ context before editing. Bibliographic source titles, recognised acronyms, historical names, and terminology deliberately needed for exam recognition were not mechanically translated.

## Applied findings

High-confidence corrections affected 356 learner-facing text slots:

- 260 fields/options in 215 canonical MCQs;
- 63 fields/options in 46 vignette questions;
- 30 title/topic/body fields across the 20 vignette containers;
- 3 app category labels kept synchronized with corrected topic metadata.

Main corrected families:

### TERMINOLOGY_REGRESSION

- dissociative psychopathology: `αποσυνδετικά` → `διασχιστικά`;
- agitated patient/state: adjectival `διεγερτικός` → `διεγερμένος` / `ψυχοκινητική διέγερση`;
- physical examination: `φυσική εξέταση` → `σωματική εξέταση`;
- loading dose: `δόση εφόδου` → `δόση φόρτισης`;
- circumstantiality: `περιστασιακή λεπτολογία` → `υπερλεπτομερειακός λόγος`;
- autonomic hyperactivity: `αυτόνομη υπερδραστηριότητα` → `υπερδραστηριότητα του αυτόνομου νευρικού συστήματος`;
- delirium: learner-facing isolated English `delirium` → `ντελίριο` (the historical label `delirium tremens` was retained);
- hypoactive delirium: `υποδραστήριο ντελίριο` → `υποκινητικό ντελίριο`;
- neuroanatomy/neuroscience: `nucleus accumbens`, `nigrostriatal`, and `working memory` were aligned to `επικλινής πυρήνας`, `μελανοραβδωτή οδός`, and `μνήμη εργασίας`.

### HYBRID_ENGLISH_GREEK / UNNATURAL_GREEK

- `vignette` → `κλινικό σενάριο` in learner-facing text (bibliographic source fields were preserved);
- `rapid cycling` → `ταχεία εναλλαγή φάσεων`;
- `craving` → context-appropriate `έντονη επιθυμία για χρήση`;
- `libido` → `σεξουαλική επιθυμία`;
- `liaison psychiatry` → `διασυνδετική ψυχιατρική`;
- forensic topic labels → `ιατροδικαστική ψυχιατρική`;
- recurring hybrid terms such as `Schema Therapy`, `motivational interviewing`, `severity specifiers`, `steady state`, `off-label`, `intention-to-treat`, `per-protocol`, `testamentary capacity`, `anger-management`, and `role-playing` were translated or given a Greek recognition gloss where their meaning was unambiguous;
- `HPA axis`, `screening test`, voltage-dependent/sensitive wording, sleep-walking/eating/driving, `worry`, `sheltered work`, and treatment `augmentation` were naturalised where the intended construct was unambiguous;
- repeated vignette boilerplate (`Η ειδικότητα εξετάζει...`, `Το περιστατικό οργανώνεται...`) was rewritten as natural clinical Greek without changing answer logic.

### MEANING_STRENGTH_DRIFT

No high-confidence translation-caused change in recommendation strength, causality, diagnostic criteria, dose, or timing was found that required a factual edit. Candidate uses of `απαραίτητο` and `επιβάλλει` were inspected in context and retained when the clinical statement itself justified that strength.

## REVIEW_ONLY — unchanged pending human adjudication

The following were deliberately not standardised:

- `contingency management` / `διαχείριση ενδεχομένων`: IDs 444, 2522, 2536. Translation Guide v4 explicitly leaves the canonical Greek unresolved.
- `uncompetitive/open-channel` NMDA antagonist and `tonic/phasic`: ID 942. The guide explicitly requires retention of `uncompetitive` pending adjudication.
- `lead-pipe` rigidity: IDs 137, 445, 468, 470, 1424, 1840, 2363, 2964. A single natural, exam-recognisable Greek house form is not yet frozen.
- `token economy`: ID 2658. A durable choice between `οικονομία μαρκών`, an explanatory phrase, and English recognition wording needs adjudication.
- `rapid tranquillisation`: ID 2109. The current English term was retained for exam recognition pending a house form.
- `trait` / `state`: ID 2986. These should remain distinct, but the preferred compact Greek pair is not frozen.
- `depot`: IDs 424, 505, 989, 1533, 1552, 2886. It is recognisable specialist shorthand; a corpus-wide switch to `μακράς δράσης` could erase formulation-specific exam wording.

## Proposed additions to the translation authority

These recurring conclusions are supported by this corpus and by applied language already present on `greek-v5-scale`, but are not explicit enough in Translation Guide v4:

1. Add `clinical vignette` → `κλινικό σενάριο`; avoid raw `vignette` in learner-facing Greek while preserving bibliographic titles.
2. Freeze `rapid cycling` as `ταχεία εναλλαγή` with a decision between `φάσεων` and `επεισοδίων`; retain `(rapid cycling)` on first use when exam recognition benefits.
3. Add explicit entries for `liaison psychiatry` → `διασυνδετική ψυχιατρική` and `forensic psychiatry` → `ιατροδικαστική ψυχιατρική`, while preserving the guide's distinction for forensic history.

No change was made to Translation Guide v4 in this task.

## Integrity and validation

Automated before/after structural comparison against the Psych baseline verified:

- canonical MCQs: 1,843 before and after;
- vignette MCQs: 107 before and after;
- populated vignette containers: 20 before and after;
- question IDs and order unchanged;
- all IDs unique within each audited bank;
- every correct-answer index/array unchanged;
- option counts unchanged; option edits stayed at their original indexes;
- no options were inserted, deleted, or reordered;
- JavaScript module structure remained loadable.

Repository checks and deployment status are recorded in the final task report after they run.
