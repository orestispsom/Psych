# PsychQuiz expansion

Scope: bring the learner-facing Psych features into the native WoW addon in stages. This is an implementation sequence, not a claim that all features are delivered. Web administration, authentication/profile management, external browser links, and any voice/network-dependent functions require a separate compatibility decision before declaring full parity.

## Stage 1 — navigation, MCQ search and progress

Implemented: a home menu with resume, MCQ modes, search, progress and settings. Search accepts Greek with or without capitals/accents, requires all query terms, supports exact question IDs, displays at most 40 results with the full match count, and opens a question preview followed by explicit one-question practice. Browsing never replaces an active run. Progress summarizes only IDs in the current MCQ bank, with answered coverage, mastery, due counts, attempt accuracy and per-topic navigation. Existing derived state and desktop acknowledgment rules remain authoritative.

Acceptance: search results agree with source IDs; removed IDs never contaminate totals; Greek input is preserved without corrupting UTF-8; normal quizzes and retakes still work; browsing preserves active answers; search input does not take focus automatically; Escape clears search focus; single-question practice emits normal MCQ answer events. Local nonvisual tests pass. In-game rendering and search interaction remain pending.

## Stage 2 — content library

Port oral sections and their authored answers, SOS material, reference tables, and the Study library. Compile the existing canonical data deterministically, preserve source IDs/revisions/provenance, and handle retired oral questions explicitly. Provide source navigation, full-text search, saved reading position and answer reveal. Native reading layouts must preserve clinical wording and table relationships; rendering failures are blockers, not permission to silently flatten or omit material. Content transfer does not confer new medical approval.

Relevant source: src/data/oral*.js, src/components/OralWorkspace.jsx, src/data/sos.js, src/data/crucialQuestionsContent.js, src/data/highYieldPsychiatryTables.js, src/data/oxfordBoxes.js, src/data/crashCourseBoxes.js, src/data/psychotropicCyp450.js, public/study/runtime-content*.json and docs/psych-study-integration.md.

## Stage 3 — practice parity

Add the remaining MCQ behavior: daily prioritization, bookmarks, topic coverage, mini-test history/scoring, written-exam navigation/history, clinical vignettes, matching and DSM self-exams. Preserve each format's real question/answer structure and scoring; matching is not a single-choice fixture. Add oral reveal/mastery practice and Study → Recall → Revisit with the four ratings and the separate Study scheduling rules.

The Study section uses ts-fsrs with separate stable question IDs and review events. MCQ mastery is not a substitute for its scheduler. Scheduler parity requires version-bound reference vectors against the actual app implementation; unsupported scheduling is an explicit blocker until parity is verified.

## Stage 4 — expanded synchronization

Extend the existing desktop bridge to oral, SOS and Study events, bookmarks, preferences and supported session history. Keep progress types distinct, append immutable attempts, deduplicate exact event IDs, preserve active device sessions, validate source revisions and reconcile concurrent app/addon work. Test offline/retry/restore and seed behavior before release.

The native addon remains offline; the existing desktop bridge is the network boundary. No credentials go into Lua. Database/schema changes must follow their owning contracts; do not invent event-mode mappings or overwrite existing app history.

## Delivery rules

No inactive placeholder tabs. Each stage exposes only implemented behavior, runs relevant native logic and integration checks, and receives in-game acceptance. Preserve the current quiz, retakes, dark theme, saved progress and private profile/seed data. PR #42 is the current addon task claim; merges remain gated by repository validation requirements.
