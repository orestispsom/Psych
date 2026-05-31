# MCQ Quality Audit

This file tracks editorial and content-quality review of `src/data/questions.js`.

## Review Criteria

- The stem is clear and asks one answerable question.
- Options are coherent, mutually plausible, and belong to the same clinical/conceptual domain.
- The marked answer matches the stem and explanation.
- The explanation supports the marked answer and explains why close distractors are wrong when needed.
- The item does not use poor distractors such as irrelevant treatment domains, mismatched lab tests, or copied options from another question.
- Current clinical items should be checked against up-to-date guidance before final approval.

## Fixed

### Q176

- **Issue:** The marked correct option was copied from an unrelated endocrine/metabolic question: `Παραθυρεοειδής ορμόνη και διορθωμένο ασβέστιο`.
- **Fix:** Replaced that option with `Ο Erikson έδωσε έμφαση στην ψυχοκοινωνική ανάπτυξη σε όλη τη διάρκεια της ζωής`.
- **Status:** Fixed in `src/data/questions.js`.

### Q001-Q050 Conservative Wording/Precision Fixes

- **Q009:** Reworded the correct memory option from `Βραχυπρόθεσμη/επεισοδιακή μνήμη` to `Πρόσφατη επεισοδιακή μνήμη` and clarified the explanation around recent episodic memory and hippocampal/medial temporal involvement.
- **Q011:** Corrected the dopamine pathway distractor wording from `Φυμοϋποφυσιακή οδός` to `Φυματο-υποφυσιακή / tuberoinfundibular οδός`.
- **Q012:** Reworded the acute dystonia stem; `οξεία πάκνωση του τραχήλου` was unclear/incorrect, replaced with `οξεία επώδυνη σύσπαση του τραχήλου`.
- **Q014:** Reworded clozapine monitoring explanation to avoid jurisdiction-specific monitoring schedules and to use WBC/ANC protocol language.
- **Q019:** Standardized `Νευροληπτικό Κακοήθες Σύνδρομο`, `μυϊκή ακαμψία`, and made treatment wording less over-specific.
- **Q027:** Clarified that the item asks for first-line **pharmacotherapy** for most anxiety disorders, not overall treatment.
- **Q033:** The stem said the patient requested medication but the correct option included CBT. Reworded the stem/option/explanation so the item is about first-line treatment and does not imply CBT is a medication.
- **Q034:** Reworded the propranolol item to focus on performance anxiety rather than implying beta-blockers are treatment for generalized social anxiety disorder.

## Automated Triage Notes

The first full-bank structural scan found no invalid `correct` indexes, missing option arrays, or duplicate option sets.

Items flagged by lexical heuristics should be treated as triage, not proof of error. For example, `Όλα τα παραπάνω` answers can appear suspicious to a simple overlap scanner even when the item is valid.

### Needs Human Review From Automated Triage

All automated triage items from the first pass have now either been repaired or cleared during manual review.

## Chunk Review Log

Manual chunk review is being completed in batches:

- Q001-Q050: Reviewed. No copied-answer contamination found. Answer keys retained. Conservative wording fixes made to Q009, Q011, Q012, Q014, Q019, Q027, Q033, Q034. Clinical/source-sensitive checks used current accessible guidance for schizophrenia DSM duration, lithium monitoring, ADHD onset age, anorexia BMI severity, panic treatment, and Tourette/tic pharmacotherapy.
- Q051-Q100: Reviewed. No copied-answer contamination found. Answer keys retained. Conservative wording fixes made to Q068, Q074, Q081, Q082, Q084, Q094, Q099. Q099 had no explicit question sentence in the stem and was repaired. Q074 was made less ambiguous by changing an overly pathological grief distractor. Q081 was clarified because contemporary Parkinson psychosis treatment can involve clozapine or pimavanserin, while quetiapine remains the best answer among the listed options.
- Q101-Q150: Reviewed. No copied-answer contamination found. Answer keys retained. Conservative wording fixes made to Q107, Q130, Q132, Q143, Q146, Q147. Q130 was updated to DSM-5-style functional neurological symptom language. Q143 was made clinically coherent by adding fever to the NMS presentation. Q146 was narrowed to general violence risk rather than mixing general violence and sexual violence prediction.
- Q151-Q200: Reviewed. Copied-answer contamination found and fixed in Q169. Q176, the issue you noticed, is confirmed fixed in this reviewed chunk. Answer key corrections made to Q185, where the delusional refusal more directly impairs using/weighing relevant information, and Q190, where firearm injury has the highest lethal potential among the listed methods. Conservative wording fixes made to Q170 and Q181. Q186 was reviewed from the automated triage list and retained.
- Q201-Q250: Reviewed. No copied-answer contamination found. Answer keys retained. Conservative wording and translation fixes made to Q214, Q216, Q219, Q220, Q231, Q236, Q244, and Q245. Q231 explanation was corrected because the old mapping of distractors to personality-disorder categories was misleading.
- Q251-Q300: Reviewed. No copied-answer contamination found. Answer keys retained. Conservative fixes made to Q262, Q273, Q276, Q277, Q286, Q293, and Q300. Q286 was repaired because the marked answer was a label rather than a patient profile, despite the stem asking for a patient. Q293 was made less ambiguous by removing ADHD as a distractor because ADHD also has high heritability.
- Q301-Q350: Reviewed. No copied-answer contamination found. Answer keys retained. Conservative wording fixes made to Q308, Q309, Q312, Q313, Q314, Q316, and Q318. Q316 had an explanation/answer mismatch: the correct answer was catastrophizing, but the explanation described selective abstraction. Q318 was rewritten to avoid an `Όλα τα παραπάνω` answer.
- Q351-Q400: Reviewed. No copied-answer contamination found. Answer keys retained. Conservative wording fix made to Q354 because the stem said SSRI while one distractor was nefazodone, which is not an SSRI.
- Q401-Q450: Reviewed. No copied-answer contamination found. Answer keys retained. Conservative wording fixes made to Q401, Q435, and Q438. Q435 was clarified to avoid confusing ICD-11 Bodily Distress Disorder with body dysmorphic disorder terminology. Current anti-amyloid monoclonal antibody items Q448-Q450 were checked against current FDA information for early Alzheimer disease indication/ARIA monitoring framing.
- Q451-Q503: Reviewed. No copied-answer contamination found. Answer keys retained. Conservative wording fixes made to Q455, Q465, Q489, and Q503. Q503 had a contradictory stem that mixed "most serious possible" with "most commonly expected significant" adverse effect; it now asks cleanly about the common significant ECT adverse effect.
