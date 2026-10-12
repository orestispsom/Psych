# Project publishing rules

## Ecosystem process governance

For multi-agent and cross-repository coordination, follow `orestispsom/mental-health-core/docs/ECOSYSTEM_GOVERNANCE.md`. It governs sync, task claims, explicit supersession, semantic merge preflight, and version-bound validation; this file remains authoritative for this app's publishing/deployment rules.

- After making requested repository changes, run the smallest relevant tests and `npm run build` when the application is affected.
- For material changes, use a task-specific branch/PR. After validation and semantic preflight succeed, merge to `origin/main` so the connected Vercel project deploys it. Small, reversible maintenance may go directly to `main` only when it does not overlap active work.
- Never stage unrelated pre-existing changes, `.env`, build output, dependency folders, temporary reports, or credentials.
- Never force-push. If `origin/main` advanced or the push/merge is rejected, reconcile against current authority and report any real conflict instead of rewriting history.
- After merging/pushing to `main`, verify the GitHub commit and the corresponding Vercel production deployment. Do not claim deployment success until its status is successful.
- If validation fails, do not merge, push, or deploy.

## Reusable knowledge asset detection

The protocol is canonical in [`mental-health-core/docs/REUSE_CANDIDATE_PROTOCOL.md`](https://github.com/orestispsom/mental-health-core/blob/main/docs/REUSE_CANDIDATE_PROTOCOL.md). Follow it there — the callout format and all eight rules live in one place, so they stop drifting between repositories.

Only the local specifics are recorded here.

**What counts as a candidate in this repository:** differential frameworks, algorithms, comparison tables, high-value cases, clear explanations, common-clinician traps, patient or family explanations, teaching material, clinical-AI evaluation cases, and clinician-workflow insights.

**Where a candidate could go:** professional education · clinician resource or product · article or website · patient/family handoff · clinical-AI evaluation · clinician software.

**Local emphasis:** During board preparation the default is **note for later** unless capture takes only a few minutes and reinforces learning.
