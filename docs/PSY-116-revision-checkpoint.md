# PSY-116 revision checkpoint

Status: deferred by the user on 2026-10-12. Stop content-revision work here.

The English Study runtime update in commit `3225847acfa115d1c8270ea8e0920bfb05478d43`
advanced PSY-116 (grief, major depression and prolonged grief disorder) from
revision 2 to revision 3. The Greek runtime remained at revision 2. The loader
correctly rejected that mismatch, causing three CI failures on main.

To defer that update and restore the bilingual Study section, PSY-116's English
`revision` and `studyMarkdown` were restored from the matched import at
`9c10378`. The Greek snapshot and all topic/question IDs remain unchanged.
The English file retains its current LF line endings; its checksum in
`psychflash-import.json` was refreshed. This restores existing content without
claiming a new clinical review. Separate oral and Crash Course grief edits
already on main are outside this rollback and remain in place.

The deferred English revision is recoverable from commit `3225847`; its source
of authority remains `orestispsom/psych_flash`. No upstream files were changed.

When resuming: inspect the current upstream PSY-116 English revision, reconcile
the Greek translation under the upstream translation contract, validate both
compiled snapshots together, update import provenance/checksums, and run the
content-integrity, loader-retry and profile-boundary tests before publishing.
Do not advance the Greek revision number without reconciling its text.
