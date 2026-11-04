# MCQ surplus review

Reviewed against the 2,260-question bank at 94855ca. This is an approval queue. All entries are currently proposed and the active bank remains at 2,260.

## What qualifies

- **Duplicate:** another item tests the same decision or keyed fact. Keep the better or protected representation.
- **Depth:** a narrow detail consumes another repetition while the useful core concept remains covered.
- **Scope:** a low-priority specialist or developmental fact can leave the core bank. The listed anchors show retained adjacent coverage, not equivalent facts.

Review the tested task, rather than the topic label. Brain structures, transmitter localization, receptors, psychopathology, adult ADHD, safety, delirium and dementia remain useful even when stored in a neurology or child category. A low mock quota alone is insufficient reason to trim. Start with small batches and avoid deleting an entire clinical topic. Treat a questionable key or overconfident explanation as a quality issue unless there is a separate reason that the item is surplus.

## First batch

30 proposals would bring the bank to **2,230** (1.3% fewer). [The tracker](mcq-surplus-review.json) gives each ID, rationale and retained anchors.

| Group | Proposed IDs | Representative retained coverage |
| --- | --- | --- |
| Same learning target | 1344, 1572, 2274, 2289 | September AMPA 3428 and scan 3565. Fragile X 1412 and 2288. Hearing assessment 1521. |
| Organic and neurology depth or scope | 450, 466, 564, 944, 947, 1014, 1028, 1043, 1164, 1263, 1566 | ARIA and baseline workup 449 and 451. Neuroleptic sensitivity 429 and 946. Huntington anatomy 3427. Wilson presentation 1259. Organic red flags 219. |
| Child and developmental depth or scope | 1244, 1366, 1384, 2271, 2279, 2287, 2290, 2304, 2476, 2480, 2486, 2612, 2725, 2758, 2764 | Piaget 1289. Adaptive functioning 2283. Attachment 1247. ADHD 2293 and 2294. Encopresis diagnosis 2477 and enuresis medication safety 2484. |

Distinct details would leave the core bank, including the specialist drug combination in 947 and the arterial localization in 1566. That is a scope choice. The shortlist protects the exam sets, source-linked anchors and the Thessaloniki examiner collection.

## How to track it

Run `npm run review:mcq:surplus`. It prints the proposals with stems and keep IDs, then finds normalized same-stem groups across the bank. Use `node tools/review-mcq-surplus.mjs --json` for machine-readable output. It currently finds 27 same-stem groups. Most contain two protected records, often because the same prompt appeared in different sources. Same-stem matches are leads for review, and may disagree in key or coverage.

Add confirmed candidates to the tracker with status `proposed`, the reason, coverage anchors, and the SHA-256 of `JSON.stringify([stem, options, correct])`. Use `kept` for a rejected proposal and `retired` after an approved removal from the active bank. The report fails if a proposal targets protected material, an anchor is missing or proposed, or the stem, options or key have changed since review. It never edits the bank. If a later approved batch is applied, preserve existing IDs and review how saved exams and progress reference retired questions.

## Simulation quality and projected impact

Replayed the current 100-question selector on 40 seeded cold starts and another 40 sequential draws against an in-memory bank with these IDs omitted. The latter used recent IDs from the last two mocks, without emulating real learner votes and timestamps. All 80 draws reached 100 and the specified domain and format counts, including 11 brain-science items, 26 vignettes, one child/neurodevelopmental item and no standalone neurology. The proposed items appeared 22 times across the 4,000 live-bank slots sampled. After omission the 40 sequential draws averaged 0.68 questions shared with either of the two previous mocks.

Spot inspection across a projected mock found the intended mixture, including an akathisia case, a GABA fact, an erotomania vignette, an applied cognition case, a psychodynamic question and the Schou history item. The spot check also found residual editorial issues unrelated to surplus. For example, 537 asks for the most frequently reported imaging finding without specifying the comparison, and 2441 presents a broad therapeutic claim without naming the evidence behind it. These are review leads, not proposals to delete their learning targets.

The simulations support coverage and rotation for this batch. They do not establish psychometric difficulty, discrimination or score reliability, and the spot inspection was not a clinical re-audit of every sampled item.
