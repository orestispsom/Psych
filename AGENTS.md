# Project publishing rules

- After making requested repository changes, run the smallest relevant tests and `npm run build` when the application is affected.
- If validation succeeds, commit only files changed for the current request and push the commit directly to `origin/main` so the connected Vercel project deploys it.
- Never stage unrelated pre-existing changes, `.env`, build output, dependency folders, temporary reports, or credentials.
- Never force-push. If `origin/main` advanced or the push is rejected, stop and report the conflict instead of rewriting history.
- After pushing, verify the GitHub commit and the corresponding Vercel production deployment. Do not claim deployment success until its status is successful.
- If validation fails, do not commit, push, or deploy.

## Reusable knowledge asset detection

While completing the primary exam-app/content task, flag only **unusually reusable original clinical synthesis**: differential frameworks, algorithms, comparison tables, high-value cases, clear explanations, common-clinician traps, patient/family explanations, teaching material, clinical-AI evaluation cases, or clinician-workflow insights.

At a natural pause, use:

> **REUSE CANDIDATE — [topic]**  
> Potential uses: **[2–4 concrete destinations such as professional education, clinician resource/product, article/website, patient/family handoff, clinical-AI evaluation, or clinician software]**.  
> Why: [one sentence].  
> **Capture now, note for later, or ignore?**

Do not derail the primary task; during board preparation default to **note for later** unless capture takes only a few minutes and reinforces learning. Do not generate a full derivative asset without explicit user opt-in. Avoid routine/generic suggestions and normally surface no more than 1–2 candidates per substantive session. Preserve provenance and copyright; source-locked or proprietary material must not be repurposed as publishable/commercial copy.
