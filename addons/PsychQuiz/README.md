# PsychQuiz

Personal, offline psychiatry MCQ addon for Orestis. Mouse-only answering; no keyboard bindings, network access, automatic prompts, or game actions.

## Status

The addon, generated bank, private progress import, portable exporter and desktop synchronization are implemented. Supabase ingestion is transactional and repeat-safe. **In-game behavior and visual quality remain unverified**; the user deferred that check. WoW Forever compatibility is not established.

## Desktop sync — everyday use

1. Type `/reload` in WoW and wait for it to finish.
2. Double-click **Sync PsychQuiz.cmd** on the Windows desktop.
3. Wait for “Updated addon baseline”, then type `/reload` again.

The launcher backs up SavedVariables, validates/uploads new answers, downloads an atomic Orestis-only snapshot and replaces only the installed `ProfileImport.lua`. It never edits live SavedVariables or sends game inputs. Repeated runs cannot double-count accepted event IDs. Refresh the Psych web app to display current server progress.

Backups and reports live in `exports/wow/` in this repository. A failed upload stops the download/install step; a later batch or download failure does not undo earlier accepted batches, but retrying is safe. Multiple matching WoW accounts cause an explicit stop rather than a guessed account. No saved addon file yet means download-only initialization. Run `/psych`, answer and `/reload` to create that file.

This PC's desktop launcher points to `C:/Users/orest/.codex/worktrees/psychquiz-design` and the existing local `.env`. Keep that worktree and Node installed. It contains paths, not credentials. The portable equivalent is `npm run wow:desktop` from an environment-configured checkout.

## Install and open

From the repository root, using Node 22 or newer:

```powershell
npm run wow:questions
npm run wow:pull
npm run wow:install -- "C:/Program Files (x86)/World of Warcraft/_classic_era_"
```

`wow:pull` reads the existing local `.env` (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, or their non-VITE equivalents). In an isolated worktree, use `node --env-file="<absolute path to existing .env>" scripts/wow/pull.mjs`; do not copy credentials into the addon. The snapshot endpoint serializes with answer ingestion so acknowledgment IDs and counters agree.

Enable PsychQuiz in the character-selection AddOns list and enter `/psych`. Restart the client if a newly installed addon is not listed. `/psych reset-position` restores the default location and dimensions. The installer preserves SavedVariables and backs up an existing recognized addon folder before updating it.

Drag the title bar to move. Drag the bottom-right corner to resize both dimensions (340–900 wide; 300–1000 high). Default: 410 × 570. Collapse leaves a 36-high title/progress bar. The mode button opens settings; scroll that menu for additional controls. Background opacity and font size are adjustable; text opacity stays unchanged. Mode/filter/length changes take effect in a new session. The entire addon remains interactive during combat; there are no automatic popups.

Modes: random, category, weak, due, exam, one question. Exam feedback appears at session end. Endless mode starts another shuffled session after exhausting its eligible bank, resetting session totals but preserving all answer events. Session reset never deletes progress. Destructive local-progress reset is intentionally not exposed.

## Questions and progress

The live app's canonical source is `src/data/questions.js`, not `questions.md`. `wow:questions` validates and generates the entire bank without changing source data. The initial build contains 2,081 questions in 22 topics, including three six-choice questions; sparse numeric IDs and source metadata are preserved.

`Questions.lua` and `ProfileImport.lua` are generated, ignored by Git, and included in the local installation. The baseline contains only Orestis's study fields, never credentials. Treat the installed package as private because it includes study progress.

Run `wow:pull`, then install again, to update the baseline. If local events remain unacknowledged, the addon keeps its previous baseline and reports that the update is deferred. This avoids applying older events on top of a newer opaque aggregate. Do not delete SavedVariables to force a refresh.

## Export and synchronization

Run `/reload` or log out first: WoW writes SavedVariables to disk at those boundaries, not after every answer. A client crash can lose activity since the last flush.

Find the account-level file at:

`_classic_era_/WTF/Account/<account>/SavedVariables/PsychQuiz.lua`

```powershell
npm run wow:export -- "<absolute SavedVariables path>/PsychQuiz.lua"
npm run wow:sync -- "<absolute export path>/progress-<hash>.json"
npm run wow:sync -- "<absolute export path>/progress-<hash>.json" --apply
```

The exporter parses a restricted Lua table format; it does not execute SavedVariables. It checks profile, event identity, question content, answer indices and timestamps. Exports are private, new files in `exports/wow/`. Re-exporting the same event payload returns the same file byte-for-byte, retaining its original export timestamp. All retained events are exported so a future importer can deduplicate them by event ID. Old/unknown question content blocks conversion with an explicit error; retain the SavedVariables and original generated bank for resolution.

`wow:sync` defaults to dry-run. `--apply` enables ingestion after preflight, in atomic batches of at most 500 events. It preserves exact event payloads and rejects reused IDs with different content. Events that predate the preserved per-question server baseline require manual reconciliation; the tool stops rather than guessing how they affect incomplete historical data. Unknown/changed questions also stop validation. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Verification and compatibility

```powershell
npm run wow:test
python scripts/wow/tests/runtime.py
```

The optional Lua test requires Python `lupa` with its Lua 5.1 runtime. Node tests cover the full bank, parser safety, event validation and deterministic export. Lua tests execute production study logic using nonvisual API doubles; UI syntax is compiled. These do not prove WoW rendering or client integration.

Target inspected locally: Classic Era 1.15.9.69722, Interface 11509. No retail/private-server compatibility claim is made. The final in-game acceptance check must cover long Greek questions (2309), long explanations (2298), six choices (3221/3264/3266), minimum/maximum size, movement, collapse/expand, opacity, combat interaction, `/reload` persistence and Lua errors. No in-game screenshots have been captured.

### WoW Forever beta

The same addon also targets the locally inspected Forever beta 1.60.1.69913, Interface 16001, in `_classic_beta_`. Forever uses the modern Mainline UI architecture and combat restrictions rather than Classic Era's API. PsychQuiz does not read combat logs, units, auras, health, spells or protected actions; its ordinary frames and required global APIs pass the captured 1.60.1 API scan. Menus, navigation, and answering remain available during combat.

The current beta has a reported persistence defect: it writes addon SavedVariables but does not restore them on a cold start. PsychQuiz therefore loads `SavedVariablesSeed.lua` only when the client did not provide `PsychQuizDB`. The desktop sync validates the beta save, backs it up, uploads its events, and regenerates that seed. If Blizzard fixes SavedVariables, the native database takes precedence. The installer preserves a populated Forever seed during addon updates.

Forever use: `/reload` → double-click **Sync PsychQuiz.cmd** → `/reload`. Do this before quitting or switching clients so the external bridge captures and seeds the latest data. This beta workaround cannot protect answers from a client crash before WoW writes them. It also has not yet been visually validated in Forever; perform the manual checklist below. Beta APIs and behavior may change between builds.

Fira Sans and Noto Sans Symbols 2 are distributed under their included SIL Open Font Licenses in `Media/`. Sources: Google's `google/fonts` repository, `ofl/firasans` and `ofl/notosanssymbols2`. Greek glyph coverage and answer-state symbols were checked from the actual bundled fonts.
