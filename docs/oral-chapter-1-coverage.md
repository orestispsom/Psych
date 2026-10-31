# Chapter 1 psychopathology coverage

Clinical source review began against Psych `2f9ba2a56ac8739f41009d11938d1d1c07da5ce5`.
The editorial revision follows the user's correction to the Chapter 1 version
published in `69d760984b2bb45fe3ced1c1079b2f613488fab9`.

The current chapter contains 20 questions with direct subject/comparison titles
and explanatory prose, lists and tables. Recall axes, exam key points and trap
sections have been removed. The psychopathology-definition card and its answer
are removed at the user's request. Original question wording is restored where
it existed; the apathy/depression title uses the user's supplied wording.
Schneider's question is in Chapter 11 under its original ID and title.

## Completeness follow-up, 31 October 2026

The user identified that coverage had been too compressed. This follow-up starts
from main `b5299bf17c936095e8d8d26d85dbf4dc641e9d17` and reviews **all 20 answers**
against the explicitly requested desktop copy:
`C:\Users\orest\OneDrive\Υπολογιστής\ΘΕΜΑΤΑ ΚΑΙ ΑΠΑΝΤΗΣΕΙΣ.docx`.
Its SHA-256 is `6643aeff01e3811a2d73bde8036b96998691483a013d219f64a1b6bf72f12324`,
identical to the previously used Oxford + Προηγούμενα copy. All Chapter 1 text
and table paragraphs (0–668) were read. The seven embedded images were also
inspected: overvalued-belief themes (284), memory diagrams (470–471), catatonia
algorithm (616), and belief-comparison tables (657–658). Private source text
and images remain outside the repository.

Previously, anhedonia and alexithymia were merely named and briefly glossed in
an assessment paragraph. They now have explicit definitions alongside related
phenomena. Sixteen answers are expanded; the adequate apathy/depression,
misidentification, psychomotor-description and confusion answers are retained.
Question IDs, titles, order, the 20-question count and all existing redirects
remain unchanged. No additional questions or exam-template sections are added.

| Answer | Substantive additions | Guide paragraphs |
| --- | --- | --- |
| Mood/affect | Emotion/feeling/affect/mood; quality; instability, restraint and expression; separate anhedonia, alexithymia, loss of feeling and apathy definitions | 49–131 |
| Perception | Completion/affective illusions, eidetic imagery; defined auditory, visual, olfactory/gustatory, tactile, coenesthetic, kinaesthetic and vestibular experiences | 134–240 |
| Self/body | Ownership/privacy of thought, unity/continuity/boundaries; hemisomatognosia, anosognosia, duplication and general body-image disturbance | 340–343; 433–451; 515–532 |
| Speech | Rate, amount, volume, prosody, stammering, verbal stereotypies and coprolalia | 20–47; 268–270 |
| Thought form | Paralogical inference with an example | 248–270 |
| Belief comparison | Examples of overvalued concerns and why the same theme can have different psychopathological forms | 275–291; image 284; images 657–658 |
| Obsessions/compulsions | Thoughts/images, ruminations, doubts, unwanted impulses, avoidance and slowness; overt/covert rituals; hoarding distinction | 359–390 |
| Delusional experiences | Fabricated recollection versus reinterpretation; the guide's referential juxtaposition example | 299–317 |
| Delusional themes | Mood congruence and erotomanic behaviour/risk | 318–357 |
| Volition | Negativism, automatic obedience, apathy/abulia overlap and akinetic mutism distinction | 622–654 |
| Volition/movement | Seizure-related motor phenomena as another nonvolitional example | 641–648 |
| Memory | Recognition, working versus short-term memory, key networks, Korsakoff, localized/selective dissociative amnesia and fallibility of recovered memories | 454–494; 530–532; images 470–471 |
| Consciousness | Clarity/range/coherence; twilight versus oneiroid descriptions | 497–537 |
| Attention | Failure to sustain attention versus external distractibility | 540–550 |
| Insight | SAI-E versus BABS, their targets and opposite scoring directions | 553–560 |
| Catatonia | Qualified GABA/NMDA/dopamine models, Mitgehen/echomimia and cautious options after first-line failure | 567–618; 426–430; BAP |

The guide is a coverage checklist, not an instruction to repeat its errors.
Existing corrections below are preserved. In particular: aphasia labels are
not inverted; visual hallucinations are not automatically organic; low affect
does not prove absent emotional experience; apathy/abulia are not separated by
an absolute emotion/executive dichotomy; memory certainty is not proof of
historical accuracy; the 12 DSM catatonia signs do not gain a 24-hour threshold
or an extra criterion for echomimia. The guide's psychosis branch does not
justify routine antipsychotic escalation in active catatonia. Mechanisms remain
hypotheses, and adjuncts do not delay urgent ECT. Detailed neurotransmitter
teaching remains in Chapter 5; Schneider's criteria remain in Chapter 11.

Supplementary primary verification for the additions:

- [BAP catatonia guideline](https://pmc.ncbi.nlm.nih.gov/articles/PMC10101189/): mechanisms, signs and the qualified role of amantadine/memantine when first-line treatment is unavailable, cautioned or insufficient.
- [SAI-E clinical-insight study](https://www.sciencedirect.com/science/article/pii/S2213158218302845): three domains and higher scores indicating better insight.
- [BABS psychometric evaluation](https://pmc.ncbi.nlm.nih.gov/articles/PMC3725596/): belief-specific insight/delusionality, with higher scores indicating poorer insight.

New regression checks require actual mood/affect definition rows, place each
added concept in its appropriate answer, and render the definitions at the
existing bookmark. Earlier title, count, navigation, retirement and catatonia
criteria checks remain in force.

Validation for this follow-up: **207 tests passed, two existing skips**;
`npm run build` passed. Browser inspection of the built mood answer confirmed
the definition tables and the complete emotional-experience section, including
anhedonia/hypohedonia and alexithymia. A programmatic comparison against the
pre-edit bank confirmed 16 changed answers, 20 retained IDs and unchanged titles.
Semantic preflight used main `b5299bf17c936095e8d8d26d85dbf4dc641e9d17` and
unchanged governance blob `dfaccc78c289de5b9d0650e05029cb822f6fafe7`; open tasks
have independent scopes. Production verification follows merge.

## Previous consolidation

Four overlapping cards are consolidated without losing their distinct content:

- `oral_core_035_fu03` → `oral_core_035_fu02`: slowing, inhibition and stupor
  now accompany the general psychomotor description.
- `oral_core_035_fu05` → `Q10`: gegenhalten and the interpretation of postural signs.
- `oral_core_035_fu06` → `Q10`: ambivalence of will and motor ambitendency.
- `oral_core_017_fu02` → `Q10`: catatonia differential, including parkinsonism and akathisia.

Legacy links redirect directly to live destinations, including older links that
previously targeted a now-consolidated card. Existing historical checkmarks are
retained; they are not silently converted into completion of the larger answer.
Source audits retain historical IDs and resolve them through the current
retirement map when validating the retained content. The user’s latest editorial
direction supersedes the earlier exam-template and non-leading-title decisions.

## Source hierarchy and method

The user's `ΘΕΜΑΤΑ ΚΑΙ ΑΠΑΝΤΗΣΕΙΣ.docx` is the coverage guide, particularly its
opening Chapter 1 and recalled questions. Paragraph numbers below are zero-based
OOXML body paragraphs **including table paragraphs** (16,258 total). This differs
from older audits that indexed only top-level paragraphs; those indexes are not
silently replaced. The private guide and extracted text are not committed.

Definitions were checked against the locally supplied *Shorter Oxford Textbook
of Psychiatry*, seventh edition (published 2018; local filename says 2017), Chapter 1, printed pp. 2–20 (PDF pp.
11–29), with the language-examination discussion in Chapter 3. Existing reviewed
oral notes supply the retained material. Answers are original Greek synthesis,
not a transcription of either source.

Verification-sensitive clinical details use:

- [BAP catatonia consensus guideline (2023)](https://www.bap.org.uk/pdfs/BAP_Guidelines-Catatonia.pdf), especially definition, Table 9 (challenge), Table 10 (differential), GABA-ergic treatment recommendations and malignant catatonia recommendations.
- [NICE CG103 recommendations](https://www.nice.org.uk/guidance/cg103/chapter/Recommendations), assessment, hypoactive presentations and supportive care. Public search excerpts were available; direct page retrieval returned 403.
- [MSD professional delirium review](https://www.msdmanuals.com/professional/neurologic-disorders/delirium-and-dementia/delirium), limited role of benzodiazepines outside withdrawal.
- [Cambridge textbook excerpt on delusional misidentification](https://assets.cambridge.org/97811087/16772/excerpt/9781108716772_excerpt.pdf) and [APA textbook chapter on misidentification](https://psychiatryonline.org/doi/10.1176/appi.books.9781615379491.lg13), for intermetamorphosis, subjective doubles and mirror misidentification, supplemented by the guide's Capgras/Frégoli definitions and existing reviewed notes.

## Coverage and sequence

| Order | Question ID | Coverage | Guide paragraphs |
| --- | --- | --- | --- |
| 1 | ch1_mood_affect | Subjective mood, observed affect, quality/range/reactivity, ambivalence, anhedonia, alexithymia | 49–131 |
| 2 | Q57 | Apathy, depression and neurological differential | 130–131; retained reviewed answer |
| 3 | 3D1 | Illusions, hallucinations, modalities, special forms, recognition experiences, sleep and sensory loss | 134–240; 662 |
| 4 | ch1_self_body | Self-experience, depersonalisation/derealisation, agency, body representation | 239–240; 433–451; 515–532 |
| 5 | ch1_speech | Speech production, articulation, prosody, language and aphasia | 20–47; 268–270 |
| 6 | ch1_thought_form | Form, flow, continuity, goal, associations and illustrative distinctions | 243–270 |
| 7 | Q2 | Delusion, overvalued belief, obsession, cultural context | 273–291; 665 |
| 8 | oral_core_009_fu01 | Obsessions and compulsions | Retained reviewed answer |
| 9 | ch1_delusional_experiences | Primary/secondary, delusional mood, perception, intuition and memory | 293–317 |
| 10 | ch1_delusional_themes | Themes, mood congruence, shared beliefs, Cotard, erotomania, jealousy, infestation | 318–345; Oxford Chapter 1 |
| 11 | ch1_misidentification | Capgras/Frégoli and related syndromes; recognition versus belief; safety | 331–334; 664; verified supplementary sources |
| 12 | exam_volition | Diminished/increased volition, conflicting intentions and passivity | 622–654; 663 |
| 13 | oral_core_035 | Volition versus movement; extrapyramidal effects, chorea, tics, other involuntary or execution disorders | 404–430; 641–654; 666 |
| 14 | oral_core_035_fu02 | Quantity, quality, purpose, posture, interaction and catatonic findings; slowing, inhibition and stupor | 404–430; 667 |
| 15 | ch1_consciousness | Arousal, awareness, orientation, quantitative/qualitative disturbances and stupor | 497–537 |
| 16 | ch1_attention | Attention, concentration, distractibility, testing and confounders | 540–550 |
| 17 | ch1_memory | Encoding/storage/retrieval, temporal types, amnesia, recognition and confabulation | 454–494 |
| 18 | ch1_confusion | Confusion versus delirium/delusion; acute assessment and supportive care | 534–537; 668; NICE/MSD |
| 19 | ch1_insight | Dimensions of insight, judgment, decision-specific ability and engagement | 553–560 |
| 20 | Q10 | Full catatonia syndrome, all 12 DSM-5-TR signs, causes, workup, differential, challenge, treatment, malignant presentation and follow-up; merged postural signs, ambitendency and detailed differential | 567–652; retained reviewed answer; BAP |

## Corrections and boundaries

- The guide's mandatory 24-hour duration for DSM catatonia is not retained.
  DSM-5-TR requires at least three of the twelve named signs; no 24-hour wait is taught.
- Catalepsy and spontaneous posturing are distinguished; no universal
  60-second diagnostic threshold is imposed.
- The guide's expressive/receptive aphasia label inversion is corrected.
- Internal localisation or preserved insight alone does not settle whether an
  experience is a hallucination. Visual hallucinations are not invariably organic.
- Apathy, anhedonia and reduced affective expression remain distinct.
- Déjà vu/jamais vu are not automatically epileptic or delusional.
- Repression is not presented as a proven mechanism of dissociative amnesia;
  confabulation is not equated with deliberate lying.
- Confusion is descriptive. Delirium is an acute syndrome involving attention
  and awareness. Catatonia and delirium can coexist clinically.
- Catatonia challenge timing: IV 5 minutes, IM 15 minutes, oral 30 minutes;
  approximately 50% scale reduction supports response. A negative challenge
  does not exclude catatonia, and a positive response is not wholly specific.
- Lorazepam trial completion is qualified by resolution, intolerance, or the
  BAP dose benchmark; it is not a universal minimum target. Severe/malignant
  illness must not wait for that target before ECT. ECT consent wording is
  preserved without inventing a new Greek legal rule.
- Mechanistic hypotheses, unverifiable response percentages and experimental
  neuromodulation are not substituted for established first-line care.

## Validation

The focused tests exercise all 20 current destinations, exact restored titles,
absence of the removed exam scaffolding, previous/next sequence, the existing
catatonia bookmark, all twelve displayed criteria, and legacy links after
consolidation or chapter movement. Existing bank, retirement, source-traceability
and global-search tests also run. Browser QA and production deployment are
checked before completion; the PR records final results.
