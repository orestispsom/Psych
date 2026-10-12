# WoW → Psych MCQ and written-exam synchronization

Updated: 2026-10-12. Psych Supabase project: `mgmigrmcdlxbzzpuzzzp`.
Profile: `orestis` (display name Orestis).

## Workflow

The WoW addon is offline. It cannot push data directly to Vercel or Supabase.
The local Windows sync tool is responsible for backing up SavedVariables,
exporting and validating answer events, uploading them, pulling profile
aggregates, and refreshing ProfileImport.lua. The user must run /reload
before sync and /reload again in WoW afterward. Refresh the Psych web app.

Sources:
- `addons/PsychQuiz/Progress.lua` records answer events and explicit completed exam markers.
- `addons/PsychQuiz/Quiz.lua` records completion in both Classic Era and Forever exam modes.
- `scripts/wow/export.mjs` validates and exports events and completedExams.
- `scripts/wow/sync.mjs` uploads answers first, then completed-exam markers, and reports the outcomes.
- `scripts/wow/desktop-sync.mjs` orchestrates the local synchronization.

## Production database

Installed in the existing Psych Supabase project on 2026-10-12:

- `psychquiz_private.upsert_full_exam(text)`: auto-records 100-answered WoW sessions from normalized `question_attempts`, taking the last answer for each question.
- `psychquiz_private.on_wow_exam_answer()`: AFTER INSERT trigger `psychquiz_completed_exam_after_insert` on `question_attempts`.
- `public.psychquiz_complete_exam(p_session_id text, p_question_ids jsonb, p_completed_at bigint, dry_run boolean DEFAULT true)`: records an explicitly completed exam from the addon, including unanswered questions. Computes the score from server-side answer history; accepts no client-reported score. The function is invoker-security, with EXECUTE granted to anon and authenticated for compatibility with the existing local client sync.
- `psychquiz_private.preserve_wow_exams()`: BEFORE UPDATE trigger `psychquiz_preserve_wow_exams_before_update` on `profile_mcq_state`. Preserves server-confirmed WoW exam results during ordinary web-app profile saves.

Each exam has a stable `written-wow:<sessionId>` ID under `profile_mcq_state.state.writtenExamSessions`, used by the web app. Re-syncing the same exam replaces the same record rather than adding duplicates. Individual answers continue to use the existing `psychquiz_sync` RPC and normalized per-question tracking.

On 2026-10-12, recovered session `wow-session:1790275791-574090680:3` was backfilled at 83/100 (one repeat answer among 101 events); web profile exam history increased from 31 to 32 sessions.

## Smoke checks

1. On a Windows machine with the updated repository and addon installed, complete a 100-question WoW exam, optionally leaving some questions unanswered.
2. Run `/reload`, then `npm run wow:desktop` using the existing local Supabase environment.
3. Verify the desktop report has `status: SUCCESS` and `examsApplied >= 1`.
4. Refresh Psych on Vercel, select Orestis, and inspect the 100-question simulation history.
5. Repeat the sync. The same exam ID must appear exactly once; no answer event should be double-counted.
6. If an export is rejected because a question was removed or reworded, preserve SavedVariables and resolve the bank-version mismatch; do not skip validation.

Important: database installation and a dry-run RPC for full and partial exams were verified. An actual new client-side WoW-to-Windows-to-Vercel run requires the updated add-on to be installed on the player's computer and cannot be performed from the repository.

## Known security debt

The older Psych app uses broad anon/authenticated RLS policies for profile progress, without per-user ownership. The new exam RPC does not expand access beyond the existing project model, but authenticated, owner-scoped profile access is advisable before multi-user use.
