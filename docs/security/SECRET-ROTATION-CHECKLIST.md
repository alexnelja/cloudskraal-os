# Secret Rotation Checklist — S-C1

**Priority:** CRITICAL
**Status:** Manual action required by Alex
**Date flagged:** 2026-04-20

## Secrets to Rotate

All secrets below are in `backend/data/.env` and should be treated as compromised.

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

## After Rotation

1. Move `backend/data/.env` to `backend/.env` (matched by .gitignore)
2. Delete `backend/data/.env`
3. Verify `backend/data/.env` is NOT tracked: `git ls-files backend/data/.env`
4. Add explicit line to `.gitignore`: `backend/data/.env`
5. Redeploy on Render with new env vars
6. Verify app still works

## Verification
```bash
# Ensure .env is not tracked
git ls-files backend/data/.env  # should return nothing

# Ensure .gitignore covers it
grep "data/.env" .gitignore     # should find a matching pattern
```
