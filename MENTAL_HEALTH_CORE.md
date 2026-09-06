# Canonical shared knowledge: `mental-health-core`

`https://github.com/orestispsom/mental-health-core` is the canonical layer for clinical concepts shared across this ecosystem.

**Nothing here has moved, been rewritten, or been deleted.** No app data, question bank or dataset is affected.

## What this repository consumes

English↔Greek terminology, concept identity for question and answer content, and the epistemic vocabulary for distinguishing established evidence from convention.

## What stays here

MCQ and oral question banks, `src/data/*`, app datasets, UI, deployment, and the Supabase schema. The core owns no application data and never will.

## An issue this repository should know about

`docs/Psychiatry-Translation-Guide-v3.md` is **damaged**. It is 15,009 bytes, valid UTF-8 for only its first 7,501, and binary garbage thereafter. The break falls mid-row, inside the "Σαλάτα λέξεων / Word salad" entry.

Verified:

- the corrupt blob is the committed object, not a checkout artefact (blob SHA `f435590b6d50ee4ec50cb0eff14a9c0428a1c624`);
- it was committed already corrupt in `1d4ce75` on 2026-08-20;
- no intact revision exists in this repository's history;
- `docs/Psychiatry-Translation-Guide-v3.docx` is also unrecoverable — it has no zip end-of-central-directory record;
- `Psychiatry-Exams` holds a byte-identical damaged copy, so the duplication propagated the damage rather than providing redundancy.

Lost sections: thought content, perception, mood and affect, insight, psychopharmacology, neuroanatomy.

The 65 salvageable rows are preserved in the core at [`terminology/en-el.yaml`](https://github.com/orestispsom/mental-health-core/blob/main/terminology/en-el.yaml), every one flagged as recovered from a damaged source. **Nothing was reconstructed, and nothing should be.** A plausible Greek term generated from memory is a fabrication that becomes indistinguishable from a verified one the moment it is committed.

Both files have been left exactly as they are. Whether an intact original exists outside git — a local copy, an editor backup, a cloud sync history, an earlier export — is the highest-value open question in [`OPEN_QUESTIONS.md` Q1](https://github.com/orestispsom/mental-health-core/blob/main/docs/OPEN_QUESTIONS.md).

## How to use it

**Look up a concept.** Human: `concepts/<slug>.md` in the core. Machine: `index/concepts.json`, which is the whole core in one file. Search `aliases` too.

**Reference by `id`, not by name.** `MHC-C-###` is permanent. Slugs can change; old ones move to `aliases`.

**Add local interpretation as an overlay.** An overlay names the core concept and adds what the core does not own — audience language, exam framing, product claims, UI labels, market state. It may add. It may not restate, narrow, or contradict the core definition.

**Contribute improvements by pull request** against the core. Do not fork a definition locally. If you need to contradict the core, that is a conflict, not an overlay.

**Pin to a tag.** Current release: `v0.1.0`.

## Two things the core will not do

**It will not approve a clinical claim.** All 30 V0 concepts are `READY_FOR_FOUNDER_REVIEW`. Nothing has been clinically reviewed, so nothing in the core licenses a public clinical claim yet.

**It will not supply market evidence.** The core has no market fields and never will. Clinical plausibility is not demand, whitespace, or opportunity.

## Telling evidence from heuristic from hypothesis

Every concept carries three separate fields, which must not be collapsed:

| Field | Question |
|---|---|
| `epistemic_status` | What kind of knowledge is this? |
| `certainty` | How confident, within that kind? |
| `review.state` | Has a qualified human signed it off? |

The five epistemic values — `ESTABLISHED_EVIDENCE`, `SUPPORTED_CLINICAL_PRINCIPLE`, `EXPERT_PRACTICE`, `BTB_CLINICAL_HEURISTIC`, `SPECULATIVE` — are the ones already in use in `btb-intelligence`, adopted unchanged.

## Avoiding a second conflicting definition

Before defining a shared clinical term in this repository, search the core index including aliases.

- exists and is right → reference it;
- exists and is wrong → pull request against the core;
- exists but you need local framing → overlay;
- does not exist and two repositories need it → propose it;
- does not exist and only this repository needs it → keep it local.

## Reference

- Audit that produced this: [`docs/AUDIT-2026-09-06.md`](https://github.com/orestispsom/mental-health-core/blob/main/docs/AUDIT-2026-09-06.md)
- Ownership matrix: [`docs/OWNERSHIP_MATRIX.md`](https://github.com/orestispsom/mental-health-core/blob/main/docs/OWNERSHIP_MATRIX.md)
- Consuming guide: [`docs/CONSUMING.md`](https://github.com/orestispsom/mental-health-core/blob/main/docs/CONSUMING.md)
- Conflict rules: [`docs/SOURCE_PRECEDENCE.md`](https://github.com/orestispsom/mental-health-core/blob/main/docs/SOURCE_PRECEDENCE.md)
- Contributing: [`CONTRIBUTING.md`](https://github.com/orestispsom/mental-health-core/blob/main/CONTRIBUTING.md)
