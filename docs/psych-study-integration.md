# Μελέτη integration

PsychFlash's Study → Recall → Revisit functionality is imported as a lazy-loaded `/study` section inside Psych. Existing Psych profiles remain the only identity system. No Flash usernames, credentials or second login are imported.

## Content authority and provenance

`psychflash-import.json` pins application main and the complete Greek-content branch independently. Both datasets contain 455 topics and 1,849 answered questions. Compiled data is copied verbatim; stable topic/question IDs, revisions, study text and answers are preserved. This import does not confer a new clinical approval or replace PsychFlash's canonical authoring files. Future content updates should rebuild upstream and replace the compiled snapshot with a recorded revision and validated identity match.

## Progress contract

- A database instance is passed explicitly to every learning operation. Its name includes the exact existing Psych profile ID; profile names are not used as identity.
- IndexedDB transactions commit learner changes and an ordered outbox together. Switching profiles or leaving the section does not reassign pending work.
- `psych_study_heads` references `study_profiles(id)`; `psych_study_events` stores immutable, idempotent events. No MCQ/oral rows or columns are changed by study synchronization. The host's idempotent profile-metadata helper first ensures that an existing device-only profile has reached Supabase under the same ID.
- `psych_study_sync` locks one profile's head, assigns monotonically increasing versions and returns paginated history. It runs as security invoker, with explicit grants and RLS matching Psych's existing shared-profile model. These profiles are not authenticated private accounts.
- Client replay preserves distinct attempts, rebuilds FSRS cards from chronological review history, overlays concurrent local edits and retains first study exposure. Settings, sessions and cursor progress synchronize. Device navigation is not overwritten by cloud refresh.
- Cloud refresh runs after mutations, on reconnect/visibility and periodically while visible. Offline queues upload when the app is reopened; this is not an OS background uploader.
- The study service worker is scoped to `/study`, caches static application/content assets, and never caches Supabase responses or clears progress. A first visit needs connectivity; an installed cache permits subsequent offline study. Clearing browser storage can remove unsynced device-only work.

## Acceptance checks

Verify Greek Today, study text/summary, answer reveal, all four ratings, review scheduling, resumed sessions, Library/search, Progress, study preferences, keyboard controls, responsive layout and existing-profile switching. Check real Supabase restore using synthetic profiles and independent client stores, idempotent retries, offline queued changes and concurrent reviews. Run the existing Psych suite, imported learning/persistence suite, schema tests, content integrity tests and production build. Merge only after semantic preflight; verify the matching Vercel production commit.

## Verified for this import

Local validation: 101 tests passed (two opt-in live tests skipped), TypeScript/production build passed, seven progress-persistence checks and seven WoW checks passed, previous-oral source mapping validated, npm audit reported zero vulnerabilities. Real Supabase tests separately verified independent restores, queued reconnect, concurrent reviews and browser-origin session/preferences restoration. Desktop and mobile UI were inspected for Greek reading, search, reveal/rating, resume, preferences and profile isolation in both themes. Static offline readiness was observed; queued offline writes were simulated, rather than disconnecting the browser network. Imported clinical text was preserved without a new clinical review.

