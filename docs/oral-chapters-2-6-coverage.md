# Oral Chapters 2–6: source and coverage review

Reviewed against Psych main `7c8c79cbf542609754131e45bb547bfc1e1aacd6`.
This revision applies the user's Chapter 1 editorial preferences to Chapters
2–6: direct titles, explanatory notes, no recall axes, exam-point or trap
sections, and consolidation of repeated answers. Recalled genetics questions
remain recognizable; answers are not embedded in their titles.

## Primary sources

1. User's **ΘΕΜΑΤΑ ΚΑΙ ΑΠΑΝΤΗΣΕΙΣ.docx**, used as the coverage guide.
   Zero-based OOXML paragraph indexes include table paragraphs: classification
   691–832; assessment 834–949; ethics/civil law approximately 950–1054;
   aetiology 1057–1514, particularly research methods 1133–1157 and recalled
   genetics questions 1484–1514. These indexes use the same extraction method
   as the Chapter 1 review. Private documents/extractions are not committed.
2. **Shorter Oxford Textbook of Psychiatry**, seventh edition, Chapters 2–6.
   The local filename says 2017; the edition page states published 2018
   (preface March 2017). Chapter text: printed pp. 22–34, 36–68, 72–84,
   88–118, 120–134, respectively; PDF pages are printed page + 9. Chapter 5
   Table 5.2 and genetics discussions inform the heritability comparison,
   twin/adoption methods, epistasis, G×E and limitations of gene studies.
   Chapter 6 supplies the evidence workflow, study designs, meta-analysis,
   diagnostic accuracy and applicability distinctions.

The notes are original Greek synthesis, not source transcription. The private
guide determines coverage, not factual authority when its shorthand is wrong.

Verification-sensitive supplementary sources:

- [WHO ICD-11 clinical descriptions and diagnostic requirements, 2024](https://www.who.int/publications/i/item/9789240077263): clinical classification context; existing DSM/ICD comparison retained.
- [NHGRI epistasis](https://www.genome.gov/genetics-glossary/Epistasis), [epigenomics](https://www.genome.gov/about-genomics/fact-sheets/Epigenomics-Fact-Sheet), and [GWAS](https://www.genome.gov/genetics-glossary/Genome-Wide-Association-Studies-GWAS?id=91): definitions and limits of inference.
- [WMA Declaration of Helsinki, 2024](https://www.wma.net/policies-post/wma-declaration-of-helsinki/): independent review, voluntary research consent, vulnerability and safeguards. Research consent remains distinct from treatment consent.
- [Greek Ministry of Health: medical ethics legislation](https://www.moh.gov.gr/articles/3246-nomothesia-hlektronikhs-ygeias?fdl=8083), Law 3418/2005 articles 11–13 and 24, and [mental-health rights legislation index](https://www.moh.gov.gr/articles/citizen/dikaiwmata-lhptwn-yphresiwn-ygeias/eidikh-epitroph-elegxoy-prostasias-twn-dikaiwmatwn-twn-atomwn-me-psyxikes-diataraxes/5608-nomothesia?utm%3Ffdl=13480): Greek framework. Existing reviewed admission procedure retained; Oxford's UK legislation is not imported.
- [Parliamentary material on involuntary transfer](https://www.hellenicparliament.gr/UserFiles/67715b2c-ec81-4f0c-ad6a-476a34d732bd/12087597.pdf): framework under articles 95, 96 and 96A of Law 2071/1992.
- [NICE NG10](https://www.nice.org.uk/guidance/ng10/chapter/recommendations), particularly 1.4.23–1.4.45: existing agitation/restriction safety content checked and retained. UK detention law is not presented as Greek law.

## Coverage decisions

| Chapter | Live questions | Changes and retained coverage |
| --- | ---: | --- |
| 2 | 2 | Add categorical/dimensional/historical multiaxial comparison; retain DSM/ICD differences, reliability, validity, comorbidity and limits. |
| 3 | 5 | Organize assessment → secondary causes → EEG → violence → agitation. Expand history versus MSE, formulation, communication, responsibilities and neuropsychological assessment. Existing scales, targeted investigations and emergency management retained. |
| 4 | 6 | Add ethical principles/rights and research ethics. Merge three capacity follow-ups into Q8 and three admission follow-ups into Q9, preserving suicide, mania, self-neglect, documentation and family communication. Retain confidentiality and restrictive measures. |
| 5 | 17 | Add general causal models, separate epigenetics and gene/environment answers. Refocus Q96 on inheritance/heritability and study methods; 5A6 on epistasis; 5A3 on GWAS and difficulties finding genes. Retain neurotransmitters, circuits and disorder-specific biological examples. |
| 6 | 7 | Add EBM/PICO/applicability and diagnostic accuracy. Expand trial methods, qualitative/prognostic research, forest/funnel plots, p, confidence intervals and power. Retain frequency, effect measures, bias, confounding, reliability/validity and causality. |

Eight focused additions and seven retirements leave **37 questions in Chapters
2–6**, a net increase of one. The full bank contains **380 live questions**.
Existing disease-specific cards remain in their established chapters; relevant
schizophrenia, mood, addiction and medication content was checked for overlap.
No new duplicate disease-management answers were added.
The neurotransmitter overview now keeps the system map; the detailed dopamine
pathways, receptor families and PET caveats are together under Q95. Q14 gives a
brief developmental overview; the full developmental account stays under
jan2026_03, removing its former verbatim repetition in Q14.

## Consolidation and bookmarks

- `oral_core_007_fu03`, `oral_core_030_fu03`, `oral_core_030_fu04` → `Q8`.
- `oral_core_004_fu06`, `oral_core_031_fu02`, `oral_core_031_fu03` → `Q9`.
- `3D6` → `jan2026_22`: the stress/fear answer was repeated verbatim there;
  its OCD material already exists in full under `jan2026_05`, immediately after
  it in the Chapter 5 sequence. This is the one consolidation whose old answer
  spans two retained cards. Old links open stress/fear; OCD remains separately
  searchable, with its existing title and ID.

All redirects are direct to live IDs. Original source records and historical
audits remain archived. Mastery ticks are not silently promoted to the merged
answer. Complete replacements suppress older appended follow-ups so Q96 does
not regain its repeated G×E material after rendering.

## Factual distinctions maintained

- Heritability concerns population variance, not the genetic percentage of an
  individual's illness, recurrence risk, penetrance or twin concordance.
  Percentages are approximate and method/population dependent.
- Epistasis is not necessarily an amplification and differs from dominance.
- Epigenetic regulation, statistical G×E, rGE and photoperiod are related but
  distinct. Clock-gene responses do not establish inherited epigenetic change.
- Diathesis is not exclusively genetic and an identifiable recent stressor is
  not required in every episode. Differential susceptibility is a testable
  framework, not a universal rule. The MAOA example is historical and qualified.
- Admission, decision-making capacity and consent to a particular treatment
  remain separate assessments. Diagnosis or risk alone does not prove incapacity.
- Diagnostic sensitivity differs from positive predictive value. The numerical
  example is internally calculated, not a claim about a particular clinical test.

## Validation

Focused content tests cover the recalled genetics topics, chapter sequence,
rendered notes, search destinations and all seven legacy redirects. Local
validation: **204 tests passed, two existing skips**; `npm run build` passed.
Existing Vite configuration/chunk-size notices remain outside this content task.
The built app was inspected in the browser: Chapter 2, 4, 5 and 6 lists, the
gene/environment answer and its comparison tables. Chapter 3 assessment and
completion navigation also pass the full-app smoke tests.

Semantic preflight used current main `7c8c79cbf542609754131e45bb547bfc1e1aacd6`
and ecosystem governance file blob `dfaccc78c289de5b9d0650e05029cb822f6fafe7`.
Open PRs #62 and #42 were checked; their simulation and game-addon scopes do
not overlap the changed content, chapter assembly or tests. No authority or
publishing rules were modified. Production release must be verified against
the merged commit SHA before reporting deployment success.
