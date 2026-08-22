# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: a Greek psychiatry trainee (ειδικευόμενος/η ψυχιατρικής) preparing for the Greek psychiatry
specialty board examinations (εξετάσεις ειδικότητας) — both the written MCQ paper and the oral (προφορικά)
examination before a panel of examiners.

Situation of use, as evidenced by the application itself:

- Long, repeated, self-directed revision sessions over months, interleaved with clinical duty.
- Short opportunistic sessions on a phone (ward, transport, between patients) as well as longer desk sessions.
- The interface language is Greek throughout; the study content is Greek with English technical terms retained
  where they are the exam vocabulary (DUP, black box warnings, liaison, forensic, vignettes).
- The app is shared with other trainees: the profile screen carries the instruction
  "Μοιραστείτε την εφαρμογή υπεύθηνα", and an admin profile gates some material.

Secondary audience: other trainees the primary user shares the deployment with. They arrive without setup and
pick or create a named study profile.

## Product Purpose

A single retrieval-and-practice instrument covering the whole Greek psychiatry board syllabus, so the trainee can
practise recall against exam-shaped material and track what is genuinely mastered rather than merely seen.

Success is measured in study terms, not engagement terms: the trainee reaches material fast, answers under exam
conditions, and the app's mastery state correctly reflects what they can recall unaided on exam day.

## Positioning

The mechanism a general flashcard or quiz app could not truthfully copy: this product is built around the actual
structure of the Greek psychiatry specialty examination. It holds a curated, source-audited Greek question bank
and, critically, both halves of the exam — written MCQ practice and oral-examination preparation with the real
previous oral questions, examiner follow-ups, and an oral simulator. The mastery model is spaced-repetition over
that specific corpus, not a generic SRS wrapper.

Content provenance is a product feature, not a detail: questions carry `source`, `sourceStatus` and
`qualityStatus` fields, and repository rules (`AGENTS.md` in the companion library) forbid inventing psychiatric
facts. Trust in the material is part of the offer.

## Operating Context

Study workflows that exist today:

- **Written practice (MCQ):** 1,843 core Greek MCQs across 21 topics, played through eight distinct modes —
  Mini-test (sprint), Τυχαία Θέματα (random review), Αδύναμα Θέματα (weakness), Ερωτήσεις ανά Κατηγορία
  (per topic), Προσομοίωση 100 (a 100-question written-exam simulation with a resumable draft),
  Vignettes, Αντιστοίχηση (matching), and a DSM-5-TR self-exam bank.
- **Daily challenge:** a per-day generated question set mixing previously-wrong and due-for-review questions.
- **Oral preparation:** 129 previous oral questions with topic/subtopic taxonomy and mastery marking;
  218 oral core items including 34 anchor questions with examiner follow-ups; 100 "crucial questions" with
  long-form answers (admin-gated); an oral exam simulator that assembles a session.
- **SOS quick reference:** 62 high-yield tables, 57 key numbers, 61 critical topics, 30 differential comparisons,
  with per-entry mastery toggles.
- **Πινακάκια (reference boxes):** 258 Oxford boxes plus Crash Course material, searchable, used as a lookup
  surface rather than a practice surface.

Profiles and sync: study profiles are stored in `localStorage` and, when `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` are present, synced to Supabase tables (`study_profiles`, `user_question_state`,
`sos_mastery`, `mcq_feedback`, `app_settings`). Without those variables the app runs fully offline on local
storage. An admin profile can publish an update message and reach gated material.

## Capabilities and Constraints

Confirmed functionality that must be preserved:

- The spaced-repetition and mastery model: mastery levels, consecutive-correct tracking, review-interval
  calculation, due-date logic, weakness scoring, near-duplicate suppression, per-topic quotas in the written
  simulation, and daily-challenge composition.
- Answer recording with per-question attempt history, accuracy, seen/wrong counts, and points/streak scoring.
- The written-exam draft: a resumable 100-question simulation with saved answers and a submission flow.
- Question feedback submission to Supabase.
- Randomised option order per question, stored so a question presents consistently within a session.
- Greek-aware search normalisation (accent/diacritic folding) used by existing search boxes.

Technical constraints:

- Vite + React 19 + `react-router` v7, deployed on Vercel as a SPA with a catch-all rewrite.
- No test runner, no linter, and no type checking are configured; `npm run build` is the only validation script.
- The question bank and SOS material are code-split and lazily imported; the core bank is ~2.5 MB of JSON-in-JS
  and must stay out of the initial bundle.
- `package.json` declares `"type": "commonjs"`; data modules are ESM consumed through Vite only.
- Supabase access uses the anon key directly from the browser; there is no authenticated session.

Explicitly undecided / not claimed: there is no licensing, pricing, or institutional endorsement, and none may
be implied.

## Brand Commitments

- Name in the interface: **Εξετάσεις Ειδικότητας**; document title **Ψυχιατρική Ειδικότητα**.
- The interface is Greek. Greek is the product's voice, and section names in use are fixed vocabulary:
  Πολλαπλής Επιλογής, Προφορικά, SOS Ψυχιατρικής, Πινακάκια.
- An existing authored SVG icon set is in the codebase and is the icon vocabulary.
- Factual study content and question data are authoritative and must not be altered by design work.

## Evidence on Hand

- The running application and its 12 study datasets (counts above are read from the data, not estimated).
- `src/App.jsx` (11,407 lines) containing all logic, all components, and ~3,900 lines of CSS in a template string.
- `MCQ_QUALITY_AUDIT.md`, `ORAL_QUALITY_AUDIT.md`, `ONLINE_PROFILES_DEPLOYMENT.md`, `supabase-profiles-schema.sql`.
- Companion content library `orestispsom/Psychiatry-Exams` with its accuracy rules in `AGENTS.md`.

## Notes on derivation

This file was written from direct inspection of the running application, its datasets, and its repository, under
an explicit user instruction to proceed autonomously without an approval round. Facts above are read from code
and data. The two inferred items are the user's clinical situation of use (ward/transport/desk sessions) and the
secondary-audience reading of the sharing notice; both follow from in-app evidence but were not user-confirmed.
