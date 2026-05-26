# Online Profiles Deployment

If the app says `Local profiles only. Add Supabase environment variables for online sync.`, the deployed JavaScript was built without Supabase environment variables.

For this Vite app, `.env.example` is only documentation. Vercel does not read `.env.example` as real configuration.

## Required Vercel Settings

In the Vercel project, go to:

`Settings` -> `Environment Variables`

Add both variables exactly:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key
```

Use the Supabase `Project URL` and the `anon` / `public` key. Do not use the `service_role` key.

Apply them to `Production`. If you use preview deployments, apply them to `Preview` too.

## Required Redeploy

After adding or changing Vercel environment variables, redeploy the app.

Vite reads `VITE_*` variables at build time, so an old deployment will not pick them up automatically.

Go to:

`Deployments` -> latest deployment -> three-dot menu -> `Redeploy`

Prefer a fresh redeploy if Vercel offers that option.

## Do Not Deploy A Prebuilt Dist Folder

Do not rely on uploading the local `dist` folder to GitHub for Vercel deployment.

Vercel should build from source with:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

If Vercel serves a `dist` folder that was built locally without a real `.env`, online profiles will stay disabled.

## Supabase Table

Run `supabase-profiles-schema.sql` in the Supabase SQL editor before testing online sync.

The app expects this table:

```text
public.study_profiles
```

## Quick Test

After redeploy:

1. Open the Vercel app.
2. The profile screen should say `Online profiles enabled`.
3. Create a profile.
4. Answer and lock one MCQ.
5. In Supabase, open `Table Editor` -> `study_profiles`.
6. Confirm the row appears and `mcq_progress` updates.
