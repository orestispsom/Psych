# MCQ feedback review — 2026-09-22

## Scope

- Source: Supabase `mcq_feedback`.
- Database snapshot: 1,116 submissions on 609 question IDs, through 2026-09-20.
- Incremental review boundary: submissions after commit `6406d87` (`Review MCQ feedback items`, 2026-09-16).
- Live batch: 60 submissions on 38 question IDs. Positive votes and self-corrected comments were retained as evidence, not treated as defects.

The feedback table has no resolution field. Historical rows were therefore preserved rather than deleted. Current question text was compared with each stored `question_text_snapshot` so that already-rewritten and removed questions were not processed again.

## Applied revisions

Revised questions: 289, 295, 496, 1117, 1128, 1265, 1431, 1460, 1835, 2179, 2257, 2520, 3160, and 3301.

The revisions address:

- Greek psychiatric and medical terminology;
- single-best-answer wording and distractor plausibility;
- answer-length and absolute-qualifier cues;
- factual precision for flight of ideas, somatoparaphrenia, osmotic demyelination, automatic thoughts, and management of QTc above 500 ms with syncope;
- the spelling of the Conners rating scale.

## Removed questions

Removed question IDs: 1091, 1277, 2253, 2635, 3223, 3239, 3256, 3270, and 3303.

Reasons included repeated negative feedback, low relevance, jurisdiction-specific content, source-fragment wording, answer-key ambiguity, an oversimplified or incorrect neurobiological claim, and distractors that could not support a defensible single-best-answer item without replacing the source item wholesale.

## Feedback not applied as a defect

- Question 136 received conflicting positive and negative votes without an explanatory comment.
- Question 1487 received a follow-up comment explicitly retracting the earlier answer-key objection and then a positive vote.
- Positive votes were left unchanged.
- Historical Supabase rows were not deleted; they remain an audit trail.

## Verification references

- [NCBI MedGen: flight of ideas](https://www.ncbi.nlm.nih.gov/medgen/535446)
- [Review of body-representation disorders after stroke](https://pmc.ncbi.nlm.nih.gov/articles/PMC3172603/)
- [Review of osmotic demyelination after rapid correction of hyponatremia](https://pubmed.ncbi.nlm.nih.gov/32097948/)
- [British Heart Rhythm Society guideline for QT prolongation on antipsychotics](https://pmc.ncbi.nlm.nih.gov/articles/PMC6702465/)
- [Beck Institute material on identifying automatic thoughts](https://beckinstitute.org/wp-content/uploads/2021/08/Coping-with-Depression.pdf)
- [Conners 4 overview from Pearson Assessments](https://www.pearsonassessments.com/content/dam/school/global/clinical/us/assets/conners/conners-4-overview.pdf)
