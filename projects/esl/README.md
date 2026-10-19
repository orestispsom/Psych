# ESL — extensive symptom list

Status: **RESEARCH FOUNDATION — READY FOR REVIEW**. Retrieved 20 October 2026.

Project folder: `projects/esl/`. Branch: `codex/esl-extensive-symptom-list`.
This is an isolated research project, with no application integration or deployment.

## Main finding

[Certain] There are existing foundations worth reusing. The closest direct match is **Miriam K. Forbes and colleagues’ symptom-level work**. AMDP supplies a clinical descriptive framework; HiTOP supplies an empirical hierarchy. These serve different purposes. None of the evidence reviewed establishes a complete, reconciled inventory spanning DSM-5-TR, ICD-10, ICD-11 and all descriptive psychopathology.

## Verified starting points

| Resource | Verified contribution | Role in ESL and boundary |
| --- | --- | --- |
| **Elemental psychopathology — Forbes et al. (2024; online 2023)** | Reduced 1,419 symptom entries across 202 DSM-5 diagnostic constructs to **628 distinct symptoms**. The article links a full dataset and redundancy coding on OSF. | Closest inventory starting point. Adult-relevant Section II criteria; excludes child-only symptoms and signs needing specialized tests. Does not establish DSM-5-TR/ICD coverage. [Paper](https://doi.org/10.1017/S0033291723002544); [dataset locator](https://osf.io/r5vqk/). |
| **Reconstructing Psychopathology — Forbes et al. (2025 journal issue; copyright 2024)** | Reorganized DSM-5 symptoms into an empirical hierarchy using self-reports from **14,762 participants**. | Direct categorization precedent. A study-specific model, rather than an official revision of HiTOP or a universally validated taxonomy. [Author manuscript](https://discovery.ucl.ac.uk/id/eprint/10211601/1/Forbes%20et%20al%202025.pdf); [DOI](https://doi.org/10.1177/21677026241268345). |
| **AMDP System** | English ninth-edition manual (2018) describes **100 psychopathological and 40 somatic core items**, plus 11 and 3 supplementary items respectively. The association lists a German eleventh edition (2023). | Strong candidate for clinical definitions and examination domains. Edition counts must stay separate; full manual not inspected. [Association catalogue](https://www.amdp.de/material/buecher/); [publisher preview](https://pubengine2.s3.eu-central-1.amazonaws.com/preview/99.110005/9781616765422_preview.pdf). |
| **SCAN / Present State Examination** | The AMDP preface identifies WHO’s SCAN as a systematic psychopathology assessment with elicitation and rating guidance, citing SCAN version 2 (1994). | Candidate companion for operational definitions and assessment. Current item coverage, access and version compatibility remain unverified here. [Primary manual preview, preface pp. v–vi and references](https://pubengine2.s3.eu-central-1.amazonaws.com/preview/99.110005/9781616765422_preview.pdf). |
| **HiTOP — Hierarchical Taxonomy of Psychopathology** | Organizes psychopathology into nested dimensions, including symptom components and broader spectra. The consortium publishes a working model and revision resources. | Empirical grouping reference. Pin the actual model version before mapping; the framework is not an exhaustive symptom dictionary. [Consortium working model](https://www.hitop-system.org/current-model); [Forbes study, introduction](https://doi.org/10.1177/21677026241268345). |
| **Mapping the manuals of madness — Tio et al. (2016)** | Compares ICD-10 and DSM-IV-TR symptom networks, connecting symptoms that share diagnostic criteria. | Useful historical ICD extraction/mapping precedent. These are manual-derived connections, not proof of causal or patient-level symptom relationships. [Author-hosted paper](https://dennyborsboom.com/wp-content/uploads/2017/01/tiodsmicd2016.pdf). |
| **APA cross-cutting symptom measures** | APA offers brief cross-diagnostic screening and more detailed measures; Level 1 surveys 13 adult and 12 child/adolescent domains. | Coverage check and user-facing assessment reference; too brief to define an extensive inventory. [APA measures](https://www.psychiatry.org/psychiatrists/practice/dsm/educational-resources/assessment-measures). |
| **Human Phenotype Ontology (HPO)** | Provides hierarchical terms and semantic relationships for clinical phenotypic abnormalities, especially in genetic disorders. | Candidate identifiers and synonyms. Psychiatric completeness and individual term equivalence need assessment. [Official documentation](https://github.com/obophenotype/human-phenotype-ontology/blob/master/docs/index.md). |
| **Symptom Ontology (SYMP)** | A maintained ontology project describing symptoms and its intended inclusion of signs; repository states CC0 availability. | Another terminology candidate. No psychiatric coverage audit or mapping performed. [Official repository](https://github.com/DiseaseOntology/SymptomOntology). |
| **NIMH RDoC** | Organizes research around functional systems; NIMH explicitly describes the matrix as illustrative and evolving. | Optional research cross-reference. It is neither a diagnostic guide nor a complete symptom inventory. [NIMH explanation](https://www.nimh.nih.gov/research/research-funded-by-nimh/rdoc/about-rdoc). |

The OSF dataset is **located through the original paper, not downloaded or item-audited** in this pass. Its file-specific reuse terms and underlying third-party content need checking before importing or redistributing it. The paper’s CC BY licence alone does not establish rights to every linked asset.

## Diagnostic references for the coverage audit

[Certain] WHO publishes the **ICD-10 Clinical Descriptions and Diagnostic Guidelines (1992)** and **ICD-11 Clinical Descriptions and Diagnostic Requirements (2024)**. Their official publication records were inspected; their full contents were not extracted. Use these clinical references alongside the relevant versioned classification, rather than treating a list of diagnostic codes as symptom coverage. [ICD-10](https://www.who.int/publications/i/item/9241544228); [ICD-11 CDDR](https://www.who.int/publications/i/item/9789240077263).

DSM-5-TR coverage still requires authorized access to the specific manual and applicable updates. An inventory derived from DSM-5 must retain that label until checked against DSM-5-TR. Likewise, ICD-10, ICD-10-CM and ICD-11 require distinct source/version records.

## Proposed approach — not an adopted clinical taxonomy

[Likely] ESL will be more useful as a **reconciled concept inventory with multiple category views** than as a single diagnostic tree. Recommended next steps:

1. Inspect the Forbes OSF files, provenance and reuse terms; reproduce the published counts before using the inventory as a baseline.
2. Compare a small, clinically reviewed sample with AMDP definitions. Preserve distinctions hidden by similar wording; record uncertainty instead of automatically merging terms.
3. Audit additions against DSM-5-TR, ICD-10 and ICD-11, including associated features when the declared scope includes them. Track each source’s coverage separately.
4. Add child/adolescent, developmental, neurological/medical, substance-related, cultural and specialist phenomenology coverage explicitly. Adult diagnostic criteria alone cannot establish these.
5. Compare clinical examination domains with the empirical categories in Forbes/HiTOP. Keep one concept linkable to multiple domains and disorders.

For each future concept, the proposed minimum record is: stable ESL ID, preferred term, synonyms, original definition, symptom/sign/trait/syndrome type, source edition and locator, category mappings, population/context qualifiers, and review status. Source occurrences should remain separate from the reconciled concept so differences remain inspectable. This is a discussion proposal, not an implemented or approved schema.

Before extraction, settle the operational meaning of “symptom”: subjective experiences only, or also observed signs and maladaptive traits? My recommendation is to include symptoms and signs with explicit types, while keeping syndromes, impairment, duration, causes and diagnostic rules separately represented. Preserve source context even when normalizing wording.

## Evidence and limitations

This was a targeted discovery review, not a systematic review or exhaustive search. Evidence consists of primary article text, official organization pages, official repositories and publisher previews. Search snippets and social media were not used as final evidence. `research/source-ledger.csv` records inspected artifacts and access boundaries; `research/claim-evidence-matrix.csv` separates reported findings from recommendations. `research/review-plan.md` defines the scope.

The full DSM-5-TR, AMDP and SCAN instruments were not inspected. No complete symptom database, cross-system equivalence map, clinical validation or rights clearance exists yet. Initial discovery therefore supports selecting foundations, not claiming comprehensive coverage.

**Next action:** retrieve and inspect the Forbes OSF dataset, verify its counts and rights, and prepare a small source-linked pilot for clinical review before bulk extraction.

Validation: CSV structure, unique source identifiers, required fields, all claim-to-source references and Markdown link syntax/local targets checked; staged whitespace check passed. External sources were inspected as recorded in the ledger; this is not an automated live-link availability audit. The bundled literature-review audit targets TeX/BibTeX and is inapplicable to this Markdown review. Application build/runtime tests are inapplicable because only these research documents changed.
