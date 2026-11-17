# Oral examiner pilot

Status: **REQUIRES_CLINICIAN_REVIEW**. This is the first portable ChatGPT pilot, separate from the production simulator. It contains 10 source-grounded draft examiner guides and 30 synthetic responses with proposed criterion judgments. No clinician-rating agreement or Greek speech accuracy has been measured. The configured Project uses ChatGPT directly; the production app has no AI grading integration.

The user provisionally approved proceeding with the pilot direction on November 17, 2026. This authorizes trial work; individual criterion labels have not been clinically adjudicated.

## Generate the pilot

From the repository root (Node.js required; no additional packages):

```powershell
node --test tools/oral-pilot/pilot.test.mjs
node tools/oral-pilot/pilot.mjs export .codex_work/oral-pilot-export
```

The output has `examiner-instructions.md`, `examiner-guides.md`, `examiner-pack.json`, `calibration-review.json`, a readable `calibration-review.md`, and `manifest.json`. Output is local and should not be committed. The fixed repository source modules are loaded to preserve their question overrides and answers. Source hashes normalize line endings and invalidate the export when the source changes; re-review the relevant guide before updating hashes in `content.json`. Hashes establish version identity, not clinical correctness.

## Try it in ChatGPT

1. Create a private ChatGPT Project for this pilot.
2. Copy `examiner-instructions.md` into Project instructions and add `examiner-guides.md` as a reference file. Keep calibration examples out of the Project: they are evaluation material.
3. Start a fresh chat: `Εξέταση, oral_core_001. Πρώτα επιβεβαίωσε ότι έχεις τον οδηγό και μετά ρώτησέ με την αρχική ερώτηση.`
4. Answer in text first. Check question relevance, source use, single-question turns, four-answer limit, delayed feedback and exact evidence for judgments.
5. Test voice separately, including medication names and negation. Ask for clarification of an uncertain transcript before scoring. A signed-in Project has been configured and the revised text protocol retested as described below. Voice behavior remains unverified.

Topic IDs: `001` first psychosis; `003` clozapine; `004` mania; `006` depression; `007` suicidality; `011` delirium; `016` agitation; `017` catatonia; `018` NMS/serotonin syndrome; `031` involuntary admission. Prefix each with `oral_core_`.

## Clinical review

Review `content.json` alongside the exported guides. Each criterion contains an exact excerpt of the existing source answer, an authored clarification, and essential/extension scope. Existing follow-up answers are retained verbatim. Clarifications are new teaching prompts derived from those sources. General semantic alternatives are permitted; topic-specific acceptable alternative clinical pathways still need reviewer examples.

The 10 topics are an editorial pilot selection, not inferred exam-frequency estimates. We do not import existing 95%/100% labels as probabilities or imitate named examiners. The repository source is teaching material, not fresh verification of current evidence. Every guide is pending review. Prioritize clozapine monitoring, treatment indications, restraint protocols, and Greek involuntary-admission law. The latter is limited to reasoning and documentation until legal details are verified. No new dose, interval, legal deadline or diagnostic threshold has been researched or introduced here. Synthetic incorrect responses deliberately contain errors and must remain labeled.

## Calibrate the examiner

`calibration-review.json` contains 21 development examples and 9 holdout examples separated by topic. All are synthetic; the proposed labels are hypotheses, not clinician-rated gold. For each case, a clinician should correct the per-criterion statuses, add exact candidate evidence, and fill `reviewer`, `reviewedAt` and `reviewStatus`. Review optional criterion scope and safe alternatives, not only wording. Add real deidentified volunteered practice responses and more nuanced borderline/alternative answers before claiming grading reliability.

After review, use a separate fresh evaluation chat per response: provide the applicable guide, candidate text, and a request for per-criterion status plus exact candidate evidence. **Do not provide proposed labels to the model.** Keep holdout examples out of prompt tuning. Save actual model judgments separately; the 30-case calibration exercise has not run. Measure missed explicit errors, false error flags on correct alternatives, exact-evidence failures, and agreement with clinician judgments by criterion. An average agreement figure must not hide missed safety errors. Agree acceptance thresholds with the clinician before evaluating; do not invent a pass threshold from these 30 cases. Re-run after source, rubric, prompt or model changes.

## First live text trial — November 17, 2026

A completed anonymous ChatGPT web conversation used the original protocol and a single inline psychosis guide, with four synthetic candidate answers. The UI reported only model `default`; an underlying model/version was not available. This tested inline conversation behavior, not Project retrieval or API integration. It was not a clinician-calibrated evaluation or a held-out benchmark.

Observed: the opening question matched the guide, omitted risk led to a relevant follow-up, a request to reveal the answer and award a pass grade was resisted, and the topic closed after four answers. Three defects were visible: correctness feedback appeared before closure, answer-four examination/work-up was mislabeled spontaneous, and some quoted evidence changed capitalization. The transcript-derived excerpts and synthetic per-turn routing judgments are in `fixtures/psychosis-dialogue.json`; their provenance labels distinguish observed text from proposed judgments.

The protocol now explicitly requires question-only intermediate turns, verbatim clarifications, original answer numbers, and exact evidence quotes. `summarizeCoverage()` independently derives initial/final status, evidence answer number, spontaneous versus after-follow-up origin, and preserved error/correction history from supplied per-answer judgments. These deterministic checks do not establish the clinical validity of those judgments. Only the initial answer to the opening question counts as spontaneous; later coverage is conservatively labeled after-follow-up.

## Signed-in Project retest — November 17, 2026

The [examiner Project](https://chatgpt.com/g/g-p-6afc266c2f5c8191873279d67d8ae3cd/project) now contains the revised Greek instructions and the generated `examiner-guides.md` source file with all ten guides. The Project instruction text was checked against the normalized repository version (5,955 characters and matching checksum). Calibration examples were not uploaded. These links require access to the user's ChatGPT account; they are not public sharing links.

In the [psychosis retest](https://chatgpt.com/g/g-p-6afc266c2f5c8191873279d67d8ae3cd/c/6afc270e-c43c-83eb-8f01-be925fa52af7), the opening and subsequent clarification questions matched the guide. A partial history answer was followed by the risk question; an explicitly incorrect answer plus a request to reveal the solution/pass grade did not cause early feedback or a grade. The third candidate answer combined the corrected risk/history response and examination/work-up response. The examiner then closed within the four-answer limit, correctly attributed full coverage to answer 3 after follow-up, preserved prior errors, and used exact candidate evidence for the three criteria. It also retained the diagnostic certainty error that had not explicitly been retracted. This run differs from the original four-answer fixture because work-up was supplied in answer 3.

In a separate [clozapine scope trial](https://chatgpt.com/g/g-p-6afc266c2f5c8191873279d67d8ae3cd/c/6afc27f0-e848-83ed-acb8-151ab955c9d4), answer 1 supplied only the source's indication sentence; answers 2–4 were "Δεν το θυμάμαι." The examiner correctly credited the sole essential opening criterion as spontaneous, labeled the other two criteria as optional at opening and missing after follow-ups, and distinguished omissions from explicit errors. It closed after four answers and deferred precise monitoring schedules/thresholds to current verification. It did ask optional extensions and then a related source follow-up after the essential opening criterion was covered, whereas `nextAction()` would have closed the topic. This conversation-control deviation remains a pilot limitation; the ChatGPT UI does not execute the router.

This is limited observed behavior from a small development trial, not evidence of grading accuracy, stable model adherence across topics, or clinician agreement. The 30-case calibration exercise, independent clinical adjudication, voice testing and app/API integration remain outstanding. No validated score or pass prediction is provided.

## What the code does

`nextAction()` accepts external model/human criterion judgments, validates criterion IDs and exact candidate quotations, and selects a targeted clarification or existing harder follow-up. It enforces a supplied per-topic answer budget and avoids repeated question IDs. It does not interpret medical language or provide grading. The caller must persist transcript, asked IDs, answer count, spontaneous/prompted coverage and corrections. ChatGPT follows the text protocol without using this function; protocol compliance therefore needs transcript review. The future API app can use this routing function after structured judgments arrive.

Next integration milestone after calibration: a server-held API key, a schema-validated judgment endpoint, persisted session state, explicit untrusted-candidate boundaries, recording/transcription, and measured model/cost/latency selection. Those features are not implemented or deployed by this pilot.

## References

- [ChatGPT Projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt): files, instructions and voice.
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): output shape does not establish semantic correctness.
- [Voice workflows](https://developers.openai.com/api/docs/guides/voice-agents): a transcript-visible speech-to-text, agent, text-to-speech pipeline for later integration.
