# Secret Rotation Checklist — S-C1

**Priority:** CRITICAL
**Status:** Manual action required by Alex
**Date flagged:** 2026-04-20

## Exposure status (verified 2026-06-15)

`backend/data/.env` and `backend/data/google-credentials.json` have **never been
tracked** in git (`git log --all -- <path>` returns 0 commits) and are covered by
`.gitignore`. So there is no confirmed git leak. Rotation below remains the safe
course if the values were ever shared, logged, or pasted outside the repo — but
treat it as precautionary, not a known breach.

`frontend/.env.production` IS tracked; it contains only `VITE_API_URL` (a public
endpoint baked into the build), no secret.

## Secrets to Rotate

All secrets below are in `backend/data/.env`. Rotate if there is any chance they
leaked outside git (see exposure status above).

### 1. Google API Key
- **Where:** Google Cloud Console → APIs & Services → Credentials
- **Action:** Regenerate key, restrict to Cloudskraal domains/IPs
- **Update:** `backend/.env` (NOT `backend/data/.env`)

### 2. Turso Auth Token
- **Where:** Turso CLI or dashboard → `cloudskraal-os-alexnelja.aws-eu-west-1.turso.io`
- **Action:** `turso db tokens create cloudskraal-os`
- **Update:** `backend/.env` with new token

### 3. Supabase Service Key
- **Where:** Supabase dashboard → Settings → API
- **Action:** Regenerate service_role key
- **Update:** `backend/.env`
- **WARNING:** `service_role` bypasses ALL Row Level Security — only use server-side

### 4. Supabase DB Password
- **Where:** Supabase dashboard → Settings → Database
- **Action:** Reset database password
- **Update:** `backend/.env`

## Consolidate the .env (do this regardless of rotation)

`backend/src/index.js` runs `dotenv.config()`, which loads `backend/.env` — but
the file currently lives at `backend/data/.env`, so **none of these vars load
locally** (production sets them via the Render dashboard). Consolidate:

1. Move `backend/data/.env` → `backend/.env` (both are gitignored).
2. Delete `backend/data/.env`.
3. **Auth caveat:** once the vars load, the `/api` Supabase JWT gate becomes
   live locally. The frontend has no login wiring yet, so for local dev set
   `AUTH_DISABLED=true` in `backend/.env` (and run the api test server with it)
   until frontend auth ships. See `backend/.env.example`.
4. Redeploy on Render with the (rotated) env vars; ensure `AUTH_DISABLED` is
   **not** "true" in production.
5. Verify app still works.

Done as part of v1.0.0 release gate (2026-06-15): `.env.example` added,
`.gitignore` hardened (`data/.env`, `.env.*`, `!.env.example`).

## Verification
```bash
# Ensure .env is not tracked
git ls-files backend/data/.env  # should return nothing

# Ensure .gitignore covers it
grep "data/.env" .gitignore     # should find a matching pattern
```
