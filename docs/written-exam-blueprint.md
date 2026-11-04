# Written simulation blueprint

## Evidence and method

I coded the primary knowledge tested and the question format for each of the 98 scanned items, 65 February 2026 recall entries and 91 September 2026 recall entries. The dates identify the recalls, and the scans have no independently verified sitting date. A drug choice or adverse effect is treatment even when the case is about schizophrenia. A question about where a transmitter is produced, a receptor class, a circuit or an imaging finding is brain science. Huntington anatomy counts here as anatomy. A standalone disease-management question would count as neurology. An adolescent eating-disorder therapy item counts as psychotherapy. Age in a stem alone does not make it child psychiatry.

A vignette asks the learner to use an individual presentation or treatment history. Brief fact questions include definitions, single best statements, exceptions, named researchers, comparisons, mechanisms, time windows and quantitative estimates. The data file stores the code at the item’s one-based source position, and separately records vignette numbers. The general bank uses its clinical category plus targeted stem and keyed-choice rules. Those rules are approximate. They avoid using distractor mentions to classify a question.

The three collections are incomplete or historical evidence, not three independent official papers. I identified 34 recurring targets shared across collections, including relative schizophrenia risk, limbic structures, glutamate receptors, cohort design, Leros, lamotrigine and aripiprazole/prolactin. The counts below collapse 11 additional appearances within the same collection, leaving 60, 88 and 95 target observations. Cross-collection recurrence remains visible in the separate columns. Clusters identify a common learning target and can include different formulations. They are an editorial sample of repeats, not exhaustive semantic matching. Uncertain source items still inform the topic analysis. Their marked answers do not establish current clinical facts.

## Distribution

Counts for the evidence columns are within each collection after the repeat adjustment. The old mock column is the mean from 40 seeded cold-start mocks using the original bank-proportional selector on the same bank, with no votes or practice history. Both mock columns use the same content labels.

| Primary target | Feb / 60 | Sep / 88 | Scans / 95 | Old mock / 100 | New mock / 100 |
| --- | ---: | ---: | ---: | ---: | ---: |
| P · Psychopharmacology and biological treatment | 13 | 20 | 25 | 18.7 | 23 |
| B · Neurobiology, anatomy, receptors and physiology | 7 | 8 | 13 | 2.4 | 11 |
| M · Mood and perinatal mood | 3 | 10 | 4 | 7.8 | 9 |
| S · Psychosis, psychopathology and signs | 8 | 10 | 9 | 10.4 | 12 |
| D · Personality and temperament | 4 | 5 | 5 | 2.3 | 6 |
| O · Organic, cognition and liaison | 5 | 6 | 6 | 6.7 | 6 |
| U · Substances and toxidromes | 5 | 7 | 10 | 7.8 | 8 |
| T · Psychotherapy and psychological theory | 4 | 4 | 3 | 3.7 | 5 |
| H · Named historical and institutional facts | 4 | 1 | 3 | 1.2 | 3 |
| R · Research, measurement and classification | 4 | 3 | 7 | 7.0 | 4 |
| A · Emergencies and risk | 1 | 1 | 2 | 3.0 | 3 |
| L · Law and ethics | 0 | 1 | 1 | 2.0 | 1 |
| C · Dedicated child or neurodevelopmental topic | 0 | 1 | 1 | 5.1 | 1 |
| N · Standalone neurology | 0 | 0 | 0 | 5.4 | 0 |
| Q · Anxiety, OCD and trauma | 1 | 5 | 2 | 4.3 | 4 |
| X · Other clinical topics, including eating, functional and sexual health | 1 | 6 | 4 | 12.3 | 4 |
| Clinical vignettes, across all rows | 16 | 13 | 32 | 20.7 | 26 |

The strongest recurrent patterns are drug comparisons and safety, adult psychiatry and brain science. The latter includes regional findings, sleep physiology, transmitter localization, receptors and cell signalling. Psychotherapy covers named approaches, defense mechanisms and therapeutic choices such as ERP. Historical facts are a separate small recurring slice, including Cade/Schou, Delay and Deniker, and Leros. The sources include dementia, delirium, mimics and medication-induced neurological effects. The low allocation to standalone neurology applies to the tested objective. There is some neurodevelopmental content, including an adult ADHD differential and an autism epidemiology question, so the blueprint retains one slot.

September is especially fact-heavy. The scans contain more full case stems. The new 26/74 vignette/direct mix sits between them and near February. The direct portion still includes comparison and interpretation questions. It does not prescribe separate quotas for negative lead-ins, numbers or trivia. Mood and psychosis remain above the observed primary-topic proportions by design to keep representative adult clinical coverage, since many related questions fall under pharmacology. These are practice design choices. The counts do not estimate official exam probabilities or establish score reliability.

## Selection

The previous written selector reserved eight questions for the combined Neurological and Organic category and five for Child and Neurodevelopmental. It also gave ten slots to the three recall folders as though they were clinical topics. History, research and classification shared one slot pool. Selection had no explicit question-format target. These rules made the mix track the size and organization of the bank.

The new selector assigns the quotas above and fills each domain’s vignette and direct slots using the existing quality and recency preferences. Within a format it prefers questions outside the last two mocks. If there are too few candidates, it can reuse recent questions and borrow from the other format within the domain. Remaining gaps draw from eligible core pools. A shortage cannot add standalone neurology or more pediatric items. Known recurring targets and textual near duplicates cannot occupy multiple slots. The 28 scan items flagged for substantial source issues in the scan audit remain available in their historical collection but are excluded from newly generated scored simulations. Source folders do not receive reserved slots. Saved mocks retain the question IDs and option order with which they were created.

In 40 seeded fresh-profile draws and 40 sequential draws with recent IDs from the last two mocks, every new mock reached 100 questions and the specified domain and format counts. The sequential exercise retained the ID-based recency rule without reproducing every timestamp or feedback vote. A UI test verifies the mix through the normal simulation entry point and exercises submission, saved results and retry. The wider bank has a relatively small classified pool for brain science and history. Continued rotation may eventually reuse more items. A new independent exam can be coded the same way before changing the quotas again.

## Rotation follow-up

Question-ID rotation alone allowed the same keyed fact to recur under another ID. The selector now groups reviewed bank variants of known targets, including AMPA, Huntington/caudate, bupropion/epilepsy and SSRI half-life. Within a topic and format it ranks fresh targets ahead of alternate IDs for a target from the last two mocks, then ahead of exact repeats. A variant remains available if the fresh pool is thin. A known target can occupy only one slot per mock.

In a seeded 40-mock sequential replay, the previous selector averaged 2.15 recently seen targets per mock under a different ID and selected three within-mock duplicates across the run. The revised selector selected zero in both measures for the tracked targets. It also selected zero exact-ID repeats from the preceding two mocks in this run, compared with an average of 0.68 previously. Reviewed variants now share the domain of the tested target. For example, the Huntington caudate variants count as anatomy. All 40 mocks met the 100-item blueprint and 26-vignette target. A further 40 draws against the projected bank with all 42 surplus candidates omitted also met the blueprint. This is a rotation check for known variants, not a claim to detect all semantic overlap. The replay used recent IDs and seeded scores without reproducing real feedback or timestamp histories.
