# Roadmap — Cloudskraal CapEx Backend

Inferred from the current codebase (no explicit roadmap docs or TODOs in source).

## Security & operations

- [ ] Add authentication / authorization middleware (currently none; all routes are open)
- [ ] Rate limiting and request validation layer
- [ ] Structured logging (currently `console.error` only)

## Testing

- [ ] Add test runner and baseline tests — `package.json` has no `test` script and no tests exist
- [ ] Smoke tests for each of the 11 route groups
- [ ] Unit tests for the financial engine (WACC / NPV / IRR / payback / PI / amortization)

## Integrations

- [ ] Activate Google Calendar integration (`src/services/google-calendar.js` is wired but needs credentials + OAuth flow documented)
- [ ] Decide on a primary datastore — `@supabase/supabase-js`, `pg`, and `@libsql/client` are installed but unused; either migrate off `better-sqlite3` or remove unused deps
- [ ] Document and expose an `xlsx` import/export route (`xlsx` dep installed, no route references it)

## Data & schema

- [ ] Rename `schema-phase2` / `schema-phase3` to feature-named bundles (equipment/livestock/production vs employees/inventory/financials)
- [ ] Split `src/db/seed-wiki.js` (1,092 lines) into per-page fixtures
- [ ] Migrations story — schemas are currently applied at boot via `CREATE TABLE IF NOT EXISTS`; a real migration tool is needed before prod data lands

## Deployment

- [ ] Confirm Render persistent disk survives redeploys with seeded data; add a "seed only if empty" guard if needed
- [ ] Health check beyond liveness (DB reachability, last-seed timestamp)
