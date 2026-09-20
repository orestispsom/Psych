# Architecture and integration boundary

## Ownership and data flow

The verified canonical profile is `study_profiles.id = 'orestis'`, name Orestis. Import requests are explicitly filtered by this ID. There is no profile selection or authentication inside WoW.

`src/data/questions.js → validated Questions.lua → native Lua addon`

`Supabase atomic snapshot → ProfileImport.lua → immutable baseline + local append-only events → derived study state → SavedVariables → validated JSON → transactional ingestion → fresh snapshot`

Core owns lifecycle and palette; UI owns native ordinary frames; Quiz owns selection/session transitions; Progress owns event recording and the derived-state reducer. No Ace3, protected actions, answer keybindings, or external calls are used by Lua. The entire question bank stays out of SavedVariables.

Events use stable sparse question IDs, source-content SHA-256, bank version, zero-based answer indices, server timestamp, session ID and `wow:<installation>:<sequence>` identity. A restored/copied installation can fork the sequence; future ingestion must treat differing payloads under one ID as a conflict, never silently deduplicate them. Preserve one authoritative SavedVariables file per study installation.

Schema 0 migrates to schema 1 by adding defaults without dropping events. Unsupported future versions fail before replacing the existing global. The baseline is copied; gameplay only appends events and updates derived state. Reload rebuilds the latter and skips events explicitly acknowledged by the baseline. A changed bank never reopens a submitted item for another submission. Removed IDs are skipped in sessions but retained in history.

The local reducer follows the app's confidence-3 policy: correct +1 mastery, three consecutive correct → level 5; incorrect −2 (mastered → 3); correct intervals 1/3/7/14/21 days, incorrect review after 6 hours. It is a local study estimate, not permission to overwrite server aggregates.

## Initial database conflicts — resolved by approved migration

Observed tables: `user_question_state` (profile/question aggregate), `question_attempts` (retained events with unique profile/client_attempt_id), `profile_mcq_state` (session state), and legacy `study_profiles.mcq_progress`. Initial read found 2,473 aggregate rows: 1,937 matching this bank, 536 historical/unmatched, and 144 current questions without remote state. Historical rows were neither imported under invented IDs nor deleted.

The initial implementation stopped on three verified conflicts:

1. Live selected_index/last_selected checks allow only 0–4 and selected_option only A–E. The real bank includes six options. Coercing index 5 would corrupt answer identity.
2. Existing app events and aggregate upserts are separate operations. A unique event constraint alone does not atomically update counters/mastery. Max-counter reconciliation loses concurrent deltas; replacing counters overwrites newer app activity. Retained attempt history is incomplete, so full aggregate reconstruction from that table is not valid.
3. Existing mode constraint allows daily/random/sprint/weakness/written/category/bookmarks. WoW due/exam/quick require an approved, explicit mapping or schema change. No mapping is silently invented.

The user subsequently approved scoped database/app changes. Migration `psychquiz_atomic_events` expands sixth-answer and mode constraints, adds event provenance, and preserves the existing Orestis aggregate in an immutable per-question `event_baseline`. Existing history stays version 0; new Orestis events are version 1. No historical counts are rebuilt from incomplete history.

New answers from both the app and WoW pass through the same trigger and transactional reducer. A profile advisory lock serializes ingestion and snapshots. The reducer replays post-baseline events ordered by answer timestamp and stable ID, so late imports do not overwrite later review state. Duplicate IDs with identical payloads are no-ops; conflicting payloads roll back. Aggregate upserts (including legacy writes) can record first-seen information but cannot replace Orestis's answer counters. Other profiles retain their existing behavior. Explicit destructive answer-history resets are not introduced.

Unseen events at/before a question's preserved baseline timestamp are rejected for manual reconciliation: their chronological effect cannot be inferred from incomplete history. The migration itself refuses cutover if retained history is newer than the aggregate. Existing counts and history were backed up before migration.

The existing access model and RLS policies remain unchanged. All new functions are SECURITY INVOKER with empty search_path and explicit EXECUTE grants only for exposed endpoints; trigger helpers are not public RPC capabilities. The PC uploader is restricted to the known project and Orestis, validates against the full bank, and never embeds credentials in Lua or the desktop launcher. This is not an authentication redesign; the existing shared-profile access model remains a separate concern.

`psychquiz_sync` commits event insertion and canonical state changes together. The CLI preflights every batch, then applies at most 500 events per transaction. A connection failure may leave an accepted batch; rerunning is safe. `psychquiz_snapshot` returns matching counters and acknowledged WoW IDs under the same lock. Desktop installation uses a temporary file and atomic rename; SavedVariables itself is never overwritten.

## Acceptance status

Implemented: generated bank; private baseline; native mouse-only UI; events/derived state; portable export; transactional ingestion; atomic snapshot; desktop launcher, backups, reports and install tooling.

Verified outside WoW: full bank integrity, stable IDs/hashes, Lua 5.1 study logic, duplicate-click guard, baseline immutability, reload replay, schema handling, combat answer guard, six-choice event preservation, parser rejection of executable input, deterministic repeat exports and UI syntax.

Database verification: local Postgres tests for duplicate/conflicting IDs, chronological replay, stale aggregate protection, sixth choices, other-profile isolation, anonymous-role permissions, atomic snapshot and rollback. Live Supabase insert/retry/conflict/stale-write checks ran inside a rolled-back transaction; zero synthetic events remained. Security advisors returned no findings. Desktop download/install was exercised using the real profile; no actual WoW SavedVariables existed at that check.

Unverified: real client rendering, movement/resize/collapse, real `/reload` disk persistence, combat UI behavior and WoW Forever. User deferred the in-game check. No real gameplay answer has yet been uploaded from this PC. Local Postgres interleaving tests are not a multi-connection load test. These are not a full-addon production-readiness sign-off.
