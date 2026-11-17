# Oral examiner pilot

Status: **REQUIRES_CLINICIAN_REVIEW**. This is the first portable ChatGPT pilot, separate from the production simulator. It contains 10 source-grounded draft examiner guides and 30 synthetic responses with proposed criterion judgments. No clinician-rating agreement or Greek speech accuracy has been measured. There is no live model integration in this milestone.

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
5. Test voice separately, including medication names and negation. Ask for clarification of an uncertain transcript before scoring. Project files and instructions support a pilot; this setup has not been verified in a live ChatGPT session.

Topic IDs: `001` first psychosis; `003` clozapine; `004` mania; `006` depression; `007` suicidality; `011` delirium; `016` agitation; `017` catatonia; `018` NMS/serotonin syndrome; `031` involuntary admission. Prefix each with `oral_core_`.

## Clinical review

Review `content.json` alongside the exported guides. Each criterion contains an exact excerpt of the existing source answer, an authored clarification, and essential/extension scope. Existing follow-up answers are retained verbatim. Clarifications are new teaching prompts derived from those sources. General semantic alternatives are permitted; topic-specific acceptable alternative clinical pathways still need reviewer examples.

The 10 topics are an editorial pilot selection, not inferred exam-frequency estimates. We do not import existing 95%/100% labels as probabilities or imitate named examiners. The repository source is teaching material, not fresh verification of current evidence. Every guide is pending review. Prioritize clozapine monitoring, treatment indications, restraint protocols, and Greek involuntary-admission law. The latter is limited to reasoning and documentation until legal details are verified. No new dose, interval, legal deadline or diagnostic threshold has been researched or introduced here. Synthetic incorrect responses deliberately contain errors and must remain labeled.

## Calibrate the examiner

`calibration-review.json` contains 21 development examples and 9 holdout examples separated by topic. All are synthetic; the proposed labels are hypotheses, not clinician-rated gold. For each case, a clinician should correct the per-criterion statuses, add exact candidate evidence, and fill `reviewer`, `reviewedAt` and `reviewStatus`. Review optional criterion scope and safe alternatives, not only wording. Add real deidentified volunteered practice responses and more nuanced borderline/alternative answers before claiming grading reliability.

After review, use a separate fresh evaluation chat per response: provide the applicable guide, candidate text, and a request for per-criterion status plus exact candidate evidence. **Do not provide proposed labels to the model.** Keep holdout examples out of prompt tuning. Save actual model judgments separately; model API/ChatGPT execution has not occurred yet. Measure missed explicit errors, false error flags on correct alternatives, exact-evidence failures, and agreement with clinician judgments by criterion. An average agreement figure must not hide missed safety errors. Agree acceptance thresholds with the clinician before evaluating; do not invent a pass threshold from these 30 cases. Re-run after source, rubric, prompt or model changes.

## What the code does

`nextAction()` accepts external model/human criterion judgments, validates criterion IDs and exact candidate quotations, and selects a targeted clarification or existing harder follow-up. It enforces a supplied per-topic answer budget and avoids repeated question IDs. It does not interpret medical language or provide grading. The caller must persist transcript, asked IDs, answer count, spontaneous/prompted coverage and corrections. ChatGPT follows the text protocol without using this function; protocol compliance therefore needs transcript review. The future API app can use this routing function after structured judgments arrive.

Next integration milestone after calibration: a server-held API key, a schema-validated judgment endpoint, persisted session state, explicit untrusted-candidate boundaries, recording/transcription, and measured model/cost/latency selection. Those features are not implemented or deployed by this pilot.

## References

- [ChatGPT Projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt): files, instructions and voice.
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): output shape does not establish semantic correctness.
- [Voice workflows](https://developers.openai.com/api/docs/guides/voice-agents): a transcript-visible speech-to-text, agent, text-to-speech pipeline for later integration.
