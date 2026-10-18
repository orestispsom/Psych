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
