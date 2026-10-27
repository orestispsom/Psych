# Proposed 100-question simulation selection

Status: PROPOSED — user review required before production rollout.

Baseline inspected: Psych `78abeb90d62964fa4559953f90a723d7fddb7cdc`.

## Recommendation

Use a fixed, explicit study blueprint for topic coverage, then bounded probabilistic personalization within each topic. Topic quotas should not depend on how many questions a learner has seen or mastered. Unseen items remain eligible at an ordinary baseline weight; they receive no novelty bonus or reserved quota. Mastered items remain eligible too.

This is a proposed preparation policy. Its exact topic counts and numerical weights are editorial/product judgments, not an official psychiatry exam blueprint or an empirically optimal learning algorithm. A mock score from a familiar bank is not a calibrated probability of passing the real examination. Per-question mastery also does not establish mastery of the underlying clinical concept.

## Proposed topic distribution

Every simulation contains 100 questions. Counts describe the primary clinical topic; pharmacology questions may also exercise diagnostic or safety knowledge.

| Topic | Questions |
| --- | ---: |
| Ψυχοφαρμακολογία | 16 |
| Διαταραχές διάθεσης | 10 |
| Ψυχωτικές διαταραχές | 9 |
| Αγχώδεις, ΙΨΔ και τραύμα | 7 |
| Ψυχοπαθολογία | 7 |
| Νευρολογικές και Οργανικές Διαταραχές | 7 |
| Διαταραχές χρήσης ουσιών | 7 |
| Νευροαναπτυξιακές και παιδοψυχιατρική | 6 |
| Επείγουσα ψυχιατρική | 4 |
| Ψυχιατρική ηλικιωμένων | 3 |
| Διαταραχές προσωπικότητας | 3 |
| Ψυχοθεραπεία | 3 |
| Βιολογικές θεραπείες | 3 |
| Νομικά, δεοντολογία και ιατροδικαστική ψυχιατρική | 3 |
| Ιατρική και διασυνδετική ψυχιατρική | 3 |
| Διατροφικές διαταραχές | 2 |
| Διαταραχές ύπνου | 2 |
| Σεξουαλικότητα, φύλο και περιγεννητική ψυχιατρική | 2 |
| Σωματικά, διασχιστικά και λειτουργικά συμπτώματα | 1 |
| Κατατονία και κινητικές διαταραχές | 1 |
| Ιστορία, έρευνα και ταξινόμηση | 1 |
| **Total** | **100** |

Rationale: substantial coverage of treatment and common diagnostic syndromes, more psychopathology than the current allocation, and continued coverage of the smaller domains. Neurology/organic disease receives less weight than its share of this particular bank. This redistribution is a judgment for review; the counts cannot be inferred as real-exam frequencies from the available data.

The bank has 2,102 five-option questions. Its 241 `actual_exam` and 38 `february_2026_recall` entries provide useful question provenance, but do not constitute a verified, complete, randomly sampled series of exam papers. Their topic proportions should not be treated as ground truth. No learner account data was fetched for this analysis.

“Τράπεζα εξεταστών Θεσσαλονίκης” is a source collection rather than a clinical topic. Its 115 directly categorized questions span four broad sections. Before applying this blueprint, those items need an explicit, reviewed **simulation-only clinical-topic mapping**. Keep their source labels, question IDs, category-mode collection, and existing category progress intact. They should compete within their clinical topic, without occupying an additional source quota. Do not silently omit these items or infer their topic from a broad section alone.

## Personalization within topics

1. Baseline weight: 1 for both unseen and familiar questions.
2. For previously answered questions, add 0.35 for mastery 0–2, 0.35 when the latest answer is wrong, 0.20 for at least two consecutive wrong answers, and 0.20 for a valid review date that is due. Cap the combined learning weight at 1.9. Due mastered questions therefore receive some reinforcement, while stable mastered questions retain their baseline eligibility.
3. Apply a bounded recency multiplier. An answer today starts at 0.70 and recovers linearly to 1 over seven days. Appearance in a completed written simulation starts at 0.40 and recovers to 1 over fourteen days. Use the smaller multiplier rather than multiplying both penalties. Merely opening a question does not trigger answer recency.
4. Apply the existing quality/source signals with a bounded multiplier of 0.5–1.5. These metadata are not psychometric item-difficulty estimates.
5. Sample without replacement using the resulting positive weights. Do not sort into a deterministic queue of weakest or unseen questions. Topic quotas and duplicate safeguards still constrain the resulting paper.

No exact percentage of unseen, weak, or mastered items is guaranteed. A largely unseen bank naturally yields many unseen questions. Once everything is familiar, the same algorithm continues to mix retention checks and reinforcement. Old lifetime mistakes alone do not keep a recovered/mastered question permanently prioritized. Response time and inferred confidence are not used as difficulty estimates.

Completed simulation history supplements the 500-answer attempt buffer for recency. This uses existing saved data and requires no database/schema change.

## Findings in the current implementation

- There is no explicit unseen-first rule in the written selector. It is indirectly produced by a 14-day answer penalty, a much larger 45-day written penalty, and a first pass that excludes questions from the last two simulations regardless of their age.
- Mastery and current review needs do not affect written selection.
- Topic quotas follow bank volume, including the source collection above.
- The spare-place allocator repeatedly uses unchanged fractional remainders. With the current bank it assigns 13 psychosis questions despite a raw proportional share of approximately 5. Correct apportionment recalculates each topic’s deficit after allocating a place.
- Looking for the latest written answer only in the 500-attempt buffer loses older written history even when completed simulation records still exist.

## Evidence boundary

The [Ministry circular hosted by PIS, dated 25 September 2024](https://pis.gr/wp-content/uploads/2024/09/%CE%95%CE%BE%CE%B5%CF%84%CE%AC%CF%83%CE%B5%CE%B9%CF%82-%CE%B5%CE%B9%CE%B4%CE%B9%CE%BA%CE%BF%CF%84%CE%AE%CF%84%CF%89%CE%BD.pdf), pages 3–4, describes broad syllabus coverage, five-option single-best-answer questions, six fields established by the specialty’s examiners, and drawing 100 questions. It does not supply the psychiatry-specific topic percentages used in the proposal. The six-field process also does not by itself establish fixed six-way quotas in each drawn paper.

[Larsen, Butler and Roediger’s randomized trial](https://pubmed.ncbi.nlm.nih.gov/19930508/) supports repeated retrieval with feedback for longer-term retention in medical trainees. It used short-answer testing and does not validate this app’s proposed MCQ weights, topic counts, or recency intervals.

## Implementation and review gate

The branch contains a candidate weighted sampler, corrected bank-proportional apportionment, and regression tests. **The proposed topic table and the examiner-item clinical mappings are not wired into the application yet.** Current production is unchanged. The corrected bank-proportional allocator is temporary candidate code, not the final proposed blueprint.

After review:

1. Confirm or revise the topic table and bounded personalization policy.
2. Add and review the simulation-only clinical mappings for the 115 source-collection items.
3. Wire the approved blueprint into selection; preserve saved drafts and historical simulations as originally generated.
4. Verify 100 distinct eligible items, quota adherence, duplicate protection, and continued selection when all items are familiar/mastered. Check multiple generated papers rather than just one successful run.
5. Run the complete tests/build and browser checks, then merge and verify production under the repository publishing rules.

The tests establish algorithm behavior, not improved examination outcomes. Live two-device operation and the proposed clinical mappings have not been validated in this draft.
