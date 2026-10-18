# Oral recall: prompt and follow-up review

The machine-readable ledger is [oral-source-review.json](oral-source-review.json). It supersedes the initial lexical-candidate inventory as the prompt crosswalk. The older [thematic coverage map](oral-exam-coverage.md) remains useful for navigation but is not the evidence of paragraph-level coverage.

## Scope and counting

- All **754 nonempty paragraphs** in the first three supplied documents have a disposition: a requirement destination, a heading/separator, supporting answer material, or an unrecoverable question mark.
- **227 identified question/detail paragraphs** in the fourth document have destinations. These include its explicit oral-question lists and the additional questions on SSRI-associated apathy, post-HSV autoimmune encephalitis and medicines affecting DAT-SPECT.
- The **981 occurrence records** resolve to **163 requirement groups**. These are editorial coverage requirements, not a claim of 163 different real exam questions. Bundled recalls can require several destinations; repeated recalls remain individually traceable.
- The fourth document, **ΘΕΜΑΤΑ ΚΑΙ ΑΠΑΝΤΗΣΕΙΣ**, is the principal answer substrate. Reference-book headings are navigation aids, not additional evidence that a question was asked in an exam. The review does not mean the whole reference book was transcribed.
- Paragraph numbers are original OOXML paragraph indices, including gaps where the source contains empty paragraphs. They are not Word page numbers.

## Content changes in the follow-up pass

Three additional entries cover DAT-SPECT preparation, comparison of mood stabiliser mechanisms/serum concentrations, and psychoanalysis versus psychodynamic therapy. Confirmed detail gaps were filled within existing entries: grief stages and their limits; trauma exposure and adjustment-disorder risk; CBT-E; sexual dysfunction; gender-related care; cognitive subgroup proportions; dental health; genetic/environmental examples; animal-model limits; cannabis receptor distribution; hallucinogen duration; encephalitis; BPSD frequency; SSRI apathy; hyponatraemia; metabolic criteria; long-acting injections; NMS prognosis; persistent-depression criteria; lifetime prevalence/risk; and two-by-two RR/OR calculations. Several diagnostic answers were recast as topical informational notes.

Compared with main `22abe2bf1586e648893dcd5d6be0a7712eceae9a`, this pass changes **47 existing displayed answers** and adds **3 entries**, for **370 active entries**. The count includes removal of remaining visible source attributions; it is not a count of 47 wholly rewritten answers.

The existing 26 Oxford chapters, stable question identifiers, redirects and completion data remain the organising structure. No examiner names, examiner-specific coaching or bibliography is added to displayed answers. Internal editorial provenance is separate from learner-facing notes.

## Corrections and exclusions

Four source-1 entries contain only `?` (paragraphs **77, 79, 80, 81**); they cannot be reconstructed. Source-2 paragraphs 354 onward are labelled supplementary practice, not authenticated exam recall.

Unsafe or unsupported recalled claims are corrected rather than reproduced: automatic antipsychotic dose reduction in pregnancy; routine withdrawal seizures from natural cannabis; a universal MMSE cutoff; the anorexia suicide denominator; unqualified cognitive prevalence figures; inevitable neurodegeneration in schizophrenia; a shared mechanism for all viral/autoimmune encephalitides; identical urine/serum osmolality in primary polydipsia; universal LAI initiation rules; and absence of metabolic or impulse-control risk with aripiprazole. Conflicting metabolic-syndrome waist thresholds are tied to their respective definitions.

Source statistics are retained only with an interpretable population, outcome and time frame. A cohort proportion is not presented as an individual prediction. This is an editorial content review and application verification, not independent specialist certification of the entire question bank.

## Validation

- Final local full run: **161 passed, 2 existing skips**, with the unchanged curriculum runtime test exceeding its existing five-second limit. That test passed separately in **3.62 seconds**, without changing its timeout. All oral and app smoke checks passed against the final content.
- `npm run build`: passed, including study offline-cache generation. Existing bundle-size warnings remain.
- Previous-source validator: **196 questions, 196 mappings, 100 source chapters** validated.
- Structural checks: unique/live IDs, chapter bounds, complete sections, rectangular tables and no visible examiner/agency attributions or source links passed. No MCQ content changed.
- Local browser: metabolic-criteria table and DAT entry visually inspected; psychodynamic entry's rendered content and chapter placement checked through the accessibility tree. Search and completion behaviour are covered by UI tests.
- The JSON includes the governing main commit and a content fingerprint. Green PR checks and exact-commit production verification remain publication gates.

The ledger's `validation` object also records unresolved mapping counts and missing destination identifiers. Those checks establish traceability, not medical accuracy by themselves.

## Informational-answer follow-on

Compared with main `ad1c45505e21fc5b4fb26dfce5f7d417eee166d3`, the remaining **15 source-linked crucial answers** are rewritten in the approved informational format: Q2, Q3, Q6, Q7, Q9, Q10, Q23, Q34, Q76, Q79, Q86, Q88, Q95, Q99 and Q100. This is a bounded review of those displayed answers, not a claim that every legacy answer elsewhere in the bank has been rewritten. The original underlying crucial fields remain archived; the displayed notes preserve their substantive distinctions and the consolidated follow-up details. The bank remains at **370 entries**, with unchanged IDs and chapter assignments.

The main answer substrate remains **ΘΕΜΑΤΑ ΚΑΙ ΑΠΑΝΤΗΣΕΙΣ**: psychopathology and belief distinctions, mood diagnosis/treatment, antipsychotic pharmacology, hyperprolactinaemia and perinatal pharmacology. The other three supplied documents establish the recalled prompts and details. This pass adds concrete secondary causes to Q3, an explicit mixed amitriptyline/benzodiazepine warning to Q88, anatomical origins/targets and receptor families to Q95, and clearer treatment comparisons. Existing emergency treatment, monitoring, adverse-effect and diagnostic qualifications were checked against the previous displayed answers, including `additionalAnswer` material that the new renderer supersedes.

Verification-sensitive clarifications were checked separately from the supplied notes:

- [NICE NG10](https://www.nice.org.uk/guidance/ng10/chapter/recommendations): de-escalation, adult rapid tranquillisation choices and monitoring, including the increased frequency when asleep/sedated. These are examples within a local protocol, not a claim of Greek product availability.
- [BAP catatonia consensus](https://www.bap.org.uk/pdfs/BAP_Guidelines-Catatonia.pdf): lorazepam challenge and urgent escalation in malignant catatonia.
- [AHA poisoning guidance](https://www.ahajournals.org/doi/10.1161/CIR.0000000000001161): sodium-channel toxicity and hazards of flumazenil in mixed overdose.
- [NICE CG31](https://www.nice.org.uk/guidance/cg31/chapter/Recommendations): adequate SRI/ERP treatment before specialist augmentation; [NICE CG192](https://www.nice.org.uk/guidance/cg192/chapter/Recommendations): perinatal decisions and continuation of an effective antipsychotic when relapse risk is high.
- [EMA June 2026 review](https://www.ema.europa.eu/en/news/meeting-highlights-pharmacovigilance-risk-assessment-committee-prac-8-11-june-2026): paternal valproate evidence remains inconsistent, with precautionary measures retained.
- [Endocrine Society guideline](https://academic.oup.com/jcem/article/96/2/273/2709487): medication-related prolactin can be markedly elevated; no single concentration proves a tumour. The source's rigid >100 threshold and unplanned diagnostic withdrawal are not adopted.
- [FDA bupropion label](https://www.accessdata.fda.gov/drugsatfda_docs/label/2022/018644s061lbl.pdf): seizure and current/prior anorexia/bulimia contraindications, without extending that label to every eating disorder.
- [Greek Supreme Court Prosecutor circular 8/2025](https://eisap.gr/εγκύκλιος-8-2025/), especially pages 5–6 and 9–11 of its attached PDF: EKAB coordination, community-unit transfer and exceptional police arrangements. Q9 no longer implies that purely healthcare-led transport is already universal; operational arrangements must follow current provisions and the particular order. Admission criteria, procedural safeguards and treatment consent remain distinct.

These editorial references are not imported into the learner-facing answers. They supplement factual checking; they do not replace the user's primary answer document or authenticate additional exam recalls. Four question-mark-only entries remain unrecoverable.

Follow-on validation: 38 targeted tests passed; the previous-source validator again passed 196 questions/mappings across 100 source chapters. Baseline comparison confirmed exactly 15 changed displayed answers, unchanged IDs/chapters, complete sections, rectangular tables and no visible citations or first-person script. Q99 prose/treatment table and Q95 anatomy table were inspected in the local browser. The production build and offline-cache generation passed with the existing bundle warnings. The default full run passed 163 tests with 2 skips, but its unchanged 455-topic curriculum test exceeded five seconds; that test passed in 5.66 seconds with a command-line 15-second allowance. No repository timeout was changed. A full run with that local allowance and standard CI are required before publication.

The complete follow-on local rerun passed **164 tests with 2 existing skips** using the command-line allowance; standard CI remains the merge gate.
