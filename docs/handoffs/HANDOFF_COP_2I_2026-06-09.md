# Handoff — Cost-of-Production engine + Spec 2i (activity-based field costing)

**Date:** 2026-06-09 · **Branch:** `main` @ `aa02ec7` (pushed to `origin/cloudskraal-os`, in sync)
**Tests:** 401 passing, full `npm test` exits 0 (run from `backend/`).

## RESUME POINT → build **Spec 2i.3 (activities)** next

The keystone slice. An activity/operation ties machine+attachment (via `comboRate`,
2i.2) + operator + ha-covered into a per-field, per-activity cost, feeding
`computeFieldCop` via `include=activities`, and finally lands `cost_per_ha`. Spec:
`docs/specs/spec-2i-activity-based-field-costing.md` §2i.3 (reviewer-approved, blockers
resolved). After 2i.3: 2i.4 establishment amortise → 2h node map → (future) 2j Xero.

## How to work here (conventions this session used)
- **TDD, tests first** (Alex's explicit rule). Pattern: write `*.test.js` (RED) → schema →
  service → `computeFieldCop` integration → migration → routes → API test.
- **`computeFieldCop` opt-in `include` flags** compose additively, default off → no
  regression: currently `processing, capital, overhead, shared` (next: `activities`). Each
  adds a per-line field + a `coverage`/report note.
- **Migrations** are idempotent (PRAGMA-guarded ALTER / CREATE IF NOT EXISTS), registered via
  `runMigration` in `src/db/schema.js`. Seeds are per-context/per-enterprise guarded.
- **Provenance for future Xero** (`entry_basis` estimate|actual, `external_source`,
  `external_id` + idempotent unique index) is baked into 2i tables — **carry it into
  `field_activities` (2i.3) and 2i.4 too.**
- **Workflow:** feature branch → `git merge --ff-only` to main → `git push origin main`.
  `git fetch` first (origin was stale by months earlier; now in sync).
- **Gotcha:** the Bash cwd drifts to repo root after git commands — `cd backend` before
  `npm`/`node`. Node 26 needs better-sqlite3 v12 (already set). `*-api` tests need the server
  running on :3001 (`npm start` in `backend/`); run the full suite once (don't overlap runs —
  trips the rate limiter).

## COP family status (Spec 2)
Shipped: 2a/2b (prior) · **margin** (price×COP, `enterprise_prices.price_basis` + factorChain)
· **2f** full livestock (`computeFlockCop`, grazing/feeding transfers, two-leg net-zero,
breeding/weaned, per-kg-weaned, at-market toggle, stocking-density) · **2g.1** wine vineyard
(grape margin via seeds) · **2c/2d** capital amortisation + overhead allocation
(per_ha/per_enterprise/revenue_share) · **2e** full processing centre (batches, recirculation,
graded fractions stokke/netto/superfine/ultrafine, byproduct revenue, one-hop trace-back via
`farm_config.attribution_mode`) · **2i.1** shared inputs · **2i.2** equipment rates.

Queued: **2i.3 activities → 2i.4 establishment amortise → 2h node map**. Deferred:
**2g.2 wine cellar (SKIPPED by Alex)**, **2j Xero integration** (forward-compat already baked in).

## Key services / files
- `backend/src/services/cop.js` — `computeFieldCop` (the hub; `include` flags, margin always-on)
- `livestock_cop.js`, `internal_transfers.js`, `processing.js`, `overhead.js`,
  `shared_inputs.js`, `equipment_rates.js`
- Specs: `docs/specs/spec-2i-activity-based-field-costing.md`, `spec-2f.2-...md`, `benched-*.md`
- Research: `docs/research/rooibos-cost-structure-2026-06.md` (full cost taxonomy — labour ~70%,
  price is master lever, ranked missing costs), `rooibos-grading-and-stof-economics.md`,
  `livestock-cop-inputs-2026-06.md`

## Domain notes carried in memory
- **Stof = valuable fines** (superfine 40–60 / ultrafine >60 holes/inch), R6→R24/kg; both
  stof+stokke currently recirculate (corncutter → fermentation heap for colour).
- **Instant-tea play**: reprocess +40 fines + market instant tea in-house (scenario model TODO).
- **Cost model gap Alex raised**: shared/multi-field inputs (2i.1, done) + activity costing
  (machines amortised + fuel + operator, per activity) — the reason Spec 2i exists.
- Wanted later: **cost build-up node map** (toggle layers = include flags, what-if cost editing,
  field ↔ Cloudskraal-average R/kg; distinctive design pass; reuse the app's D3 graph).

## Working tree
Clean except untracked `docs/journey-into-cloudskraal-capex.md` (parallel-session artifact —
left alone all session).
