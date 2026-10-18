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

## Remaining mapped recall answers

Against main `df9294db105d8bff04885c0158269afa3191f14d`, this pass expands the final **20 mapped destinations** that still used brief legacy answers: 1Aa1, 1Ca4, 1Cg1, 2Ad4, 3A4, 3A8, 3D3, 3D24, 3D28, 4A2, 4C3, 5A5, 5A7, jan2026_07, jan2026_17, oral_core_035, oral_core_035_fu02, oral_core_035_fu03, oral_core_035_fu06 and oral_core_036. Their original questions, chapter assignments and IDs remain unchanged. The bank still contains **370 entries**. All **207 distinct destinations** of the 163 recall requirements now have informational study notes; 295 entries across the whole bank use this format. This does not claim that the 75 other, unmapped bank entries have been rewritten or that every heading in the answer document is a recalled exam question.

**ΘΕΜΑΤΑ ΚΑΙ ΑΠΑΝΤΗΣΕΙΣ** remains the principal answer substrate. Relevant original OOXML ranges include perception/beliefs and movement (275–333, 404–429, 567–667), seasonal depression (3202–3212), depressive sleep (3568–3576), cyclothymia and depressive polarity (4138–4179), schizophrenia dimensions/environment (4600 onward; 5155–5238), pharmacogenetics (11574–11583), prolactin (13068 onward), ECT/light treatment (13870–13976), perinatal prescribing (14520 onward) and addiction circuitry (15577–15585). Existing displayed answers and consolidated follow-ups were compared before replacement. Pregnancy, prolactin and dissociation reuse the previously reviewed informational sections and add the specific legacy details, rather than maintaining competing shorter clinical versions.

The expansions retain all substantive legacy points and clarify: DSM acute stress disorder versus ICD acute stress reaction; immobility versus impaired consciousness; dimensional symptoms versus fixed schizophrenia subtypes; unipolar/bipolar warning features versus diagnostic proof; social mechanisms versus ethnic essentialism; gene–environment interaction versus correlation; and research circuitry versus an individual diagnostic test. The source's cyclothymia line saying symptoms do **not** cause significant distress/impairment is a transcription error and is not reproduced. Psychomotor agitation is not defined as necessarily aggressive.

Targeted factual checks supplement the supplied document without adding references to displayed answers:

- [NIMH seasonal affective disorder](https://www.nimh.nih.gov/health/publications/seasonal-affective-disorder) and [bupropion XL product information](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=a435da9d-f6e8-4ddc-897d-8cd2bf777b21&version=27): seasonal recurrence, light therapy and prevention; no Greek availability claim is made.
- [NICE social anxiety recommendations](https://www.nice.org.uk/guidance/cg159/chapter/Recommendations) and [propranolol product information](https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=abd3ef23-cc2e-4cdd-a1fc-10faf361c414): CBT and the limited, selected use/safety of beta-blockers.
- [CPIC SRI guideline](https://files.cpicpgx.org/data/guideline/publication/serotonin_reuptake_inhibitor_antidepressants/2023/37032427.pdf), [CPIC HLA guideline](https://files.cpicpgx.org/data/guideline/publication/carbamazepine/2017/CPIC_HLA_CBZ_OXC.pdf) and [FDA pharmacogenetic table](https://www.fda.gov/medical-devices/precision-medicine/table-pharmacogenetic-associations): actionable gene–drug pairs and the distinction from universal pre-prescription testing or prediction of efficacy.
- [NHS ECT medication protocol](https://www.cpft.nhs.uk/download/cl11-electroconvulsive-therapy-ect-policy-and-procedure-administration.pdf?ver=19531) and [RDaSH ECT policy](https://www.rdash.nhs.uk/policies/electroconvulsive-therapy-clinical-guidelines-policy/): medication-specific review, seizure adequacy and lithium monitoring; no universal withholding schedule is imposed.
- [BAP catatonia consensus](https://www.bap.org.uk/pdfs/BAP_Guidelines-Catatonia.pdf) and [ACLP catatonia guide](https://www.clpsychiatry.org/wp-content/uploads/ACLP-How-To-Guide-Catatonia-2025-1.pdf): preserved alertness can coexist with marked loss of interaction; medical/neurological differential remains necessary.
- [WHO schizophrenia factsheet](https://www.who.int/news-room/fact-sheets/detail/schizophrenia), [WHO cannabis report](https://www.who.int/docs/default-source/substance-use/9789241510240-eng.pdf) and [US Surgeon General neurobiology chapter](https://www.ncbi.nlm.nih.gov/books/NBK424849/): environmental risk, cannabis and the qualified reward/habit/stress model of addiction.

Validation for this pass: targeted rendering and source-map tests, baseline/structure checks, full suite, build and production verification are recorded in its PR. The source-map test now requires study notes for **every** mapped destination, beyond the crucial-question subset. Counts establish coverage and format, not independent specialist certification. The four question-mark-only recalls remain unrecoverable.

Final local results for the remaining-destination pass: **165 tests passed, 2 existing skips** with the documented command-line allowance; build and source validator passed. Standard CI and exact-commit production verification are publication gates.
