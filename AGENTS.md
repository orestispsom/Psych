# Project publishing rules

- After making requested repository changes, run the smallest relevant tests and `npm run build` when the application is affected.
- If validation succeeds, commit only files changed for the current request and push the commit directly to `origin/main` so the connected Vercel project deploys it.
- Never stage unrelated pre-existing changes, `.env`, build output, dependency folders, temporary reports, or credentials.
- Never force-push. If `origin/main` advanced or the push is rejected, stop and report the conflict instead of rewriting history.
- After pushing, verify the GitHub commit and the corresponding Vercel production deployment. Do not claim deployment success until its status is successful.
- If validation fails, do not commit, push, or deploy.
