# Spec #1 — Usage intervals & rotation-aware field state

- **Date:** 2026-04-14
- **Status:** Design approved, pending implementation plan
- **Scope:** Backend schema + API + seed migrations. Map UI consumes new endpoints but no new UI work beyond wiring the overlay to `?as_of=`.
- **Out of scope:** Field orientation, wind rows, and row-level map rendering — split into spec #1b.

## Problem

Today `fields.enterprise`, `fields.crop_type`, `fields.planted_year` are scalar "current state" columns. They cannot express:

1. **Historical usage.** "What was on C11 in 2023?" is unanswerable.
2. **Mid-year transitions.** Rooibos is removed in March, lupines planted in May, the next rooibos cycle plants the following June. The current schema forces one row per (field, year) and loses the transition.
3. **Rotation position.** Rooibos "year 4, declining" is derivable from `planted_year`; lupines "year 2 of a 3-year oats/lupines/fallow cycle" is not — nothing records cycle position.
4. **Provenance.** No way to distinguish a manually entered historical record from a derived backfill.

Spec #2 (per-field COP) cannot key inputs and yields on usage without this.

## Model

### `field_usage_period` — interval-based canonical truth

```sql
CREATE TABLE field_usage_period (
  id            TEXT PRIMARY KEY,
  field_id      TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  usage         TEXT NOT NULL,          -- crop-level enum; see USAGE_TYPES
  start_date    TEXT NOT NULL,          -- ISO date usage began on this field
  end_date      TEXT,                   -- NULL = still active
  planted_date  TEXT,                   -- often equals start_date, kept distinct
                                        -- (e.g., rooibos: planted long before topping)
  rotation_year INTEGER,                -- cycle position (1..N) for rotational;
                                        -- NULL for perennials (derive via yearsSincePlanted)
  stand_pct     REAL,                   -- cover ratio 0..100; latest known for this period
  source        TEXT NOT NULL,          -- seed-2026 | seed-rooibos-backfill |
                                        -- import-<file> | manual
  notes         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX idx_fup_field_dates ON field_usage_period(field_id, start_date, end_date);
CREATE INDEX idx_fup_active ON field_usage_period(field_id) WHERE end_date IS NULL;
```

**Invariant:** no two periods for the same field overlap. Enforced at the service layer (`assertNoOverlap`), not by schema — SQLite has no range-exclusion constraint. Adjacent periods (`a.end_date = b.start_date`) are allowed.

### `USAGE_TYPES` — crop-level enum

Source of truth: `backend/src/services/usage.js`.

Initial values (expand as the farm plants new crops):

- `rooibos`
- `lupines_fourrages`
- `oats`
- `fallow`
- `almond`
- `grazing`
- `vines` (future — present in Excel import template)
- `wheat` (future — present in Excel import template)

`PERENNIAL_USAGES = { rooibos, almond, vines }`. Perennials derive rotation year from `planted_date`; rotational crops store explicit `rotation_year`.

### `fields` columns become a current-state cache

`fields.enterprise`, `fields.crop_type`, `fields.planted_year` are retained for backward compatibility but become **refresh-on-write caches of the current active period**, not authoritative. No new code writes them directly. `refreshFieldCurrent(field_id)` picks the period satisfying `start_date <= today AND (end_date IS NULL OR end_date >= today)` and, if multiple, the one with the most recent `start_date`.

### `field_production.stand_pct` removed

Cover ratio is a state attribute of the standing crop, not of the yield event. It moves to `field_usage_period.stand_pct`. Migration step copies values by matching `(field_id, year)` to the period active at `year-06-30`.

## API

All routes live in `backend/src/routes/farms.js` (extending the existing farms router) or a new `routes/usage.js`.

### Per-field CRUD

```
GET    /api/fields/:id/usage-periods
       → [{id, usage, start_date, end_date, planted_date, rotation_year,
           stand_pct, source, notes, created_at, updated_at}]

POST   /api/fields/:id/usage-periods
       body: {usage, start_date, end_date?, planted_date?, rotation_year?,
              stand_pct?, notes?, source?}
       source defaults to 'manual' if omitted
       → 201 with full row

PUT    /api/fields/:id/usage-periods/:periodId
       → 200 with updated row, or 404

DELETE /api/fields/:id/usage-periods/:periodId
       → 204
```

### Map overlay feed

```
GET /api/usage-history?as_of=YYYY-MM-DD[&usage=rooibos]
   → [{field_id, period_id, usage, rotation_year_effective, stand_pct,
       planted_date, geometry}]
```

- `as_of` defaults to today.
- `rotation_year_effective` = stored `rotation_year` if present, else `yearsSincePlanted(planted_date, as_of)` for perennials, else `null`.
- Fields with no period active at `as_of` are omitted.
- Cacheable; cache key `(as_of, usage ?? '*')`.

### Error taxonomy

| Condition | HTTP | Body |
|---|---|---|
| Unknown `usage` | 400 | `{error: 'invalid_usage', valid: [...USAGE_TYPES]}` |
| `end_date < start_date` | 400 | `{error: 'invalid_interval'}` |
| Overlaps existing period for field | 409 | `{error: 'overlap', conflict: <period_id>}` |
| PUT/DELETE on missing period id | 404 | `{error: 'not_found'}` |
| `rotation_year` set on perennial | 200/201 + warning | `{warning: 'rotation_year_on_perennial'}` |

## Data flow

```
writes ─► field_usage_period ─► refreshFieldCurrent() ─► fields.enterprise/...
                      │
                      └─► GET /api/usage-history ─► map overlay
```

- `field_usage_period` is the **only** source of truth for historical usage.
- Spec #2 (COP) keys on `(field_id, year, usage)` by querying periods overlapping `[year-01-01, year-12-31]` and weighting inputs/yields by days-overlap.

## Seeding

1. **Create schema** — `schema-usage-periods.js` module, wired into `schema.js`.
2. **Seed from 2026 land-use.** For every field in the 2026 reconciliation, insert one period with `start_date=2026-01-01` (or `planted_date` if known), `end_date=NULL`, `source='seed-2026'`. For fallow fields, same shape with `usage='fallow'`.
3. **Backfill rooibos.** For every rooibos field with `planted_year=Y` where `Y < 2026`, insert a period `start_date=Y-01-01`, `end_date=2026-01-01` (closed when the 2026 record starts) — except for fields the 2026 seed marks as *still the same rooibos planting*, in which case the earlier period extends and no new 2026 row is inserted. Concretely:
   - Rooibos 2022/2023/2024/2025 fields that remain rooibos in 2026 → single period `start_date=Y-01-01`, `end_date=NULL`, `planted_date=Y-01-01`.
   - Rooibos fields that were ripped and replanted (different `planted` than 2026 record) → closed prior period + new 2026 period.
   - `source='seed-rooibos-backfill'` for rows that pre-date 2026.
4. **Migrate `stand_pct`.** For each row in `field_production` with non-null `stand_pct`, find the period active at `year-06-30` and copy the value. Then `ALTER TABLE field_production DROP COLUMN stand_pct`.
5. **Idempotency.** Each seed checks an existing row with matching `(field_id, start_date, source)` before insert. Re-running `npm start` is a no-op.

## Testing (tests-first)

Both test files are written failing before implementation.

### `backend/tests/usage-service.test.js` — pure unit
- `USAGE_TYPES` contains expected values; unknown values rejected.
- `assertNoOverlap`: adjacent periods (`a.end_date == b.start_date`) allowed; 1-day overlap throws.
- `refreshFieldCurrent` with no periods leaves cache untouched; with one active period updates cache; with multiple candidates picks most recent `start_date`.
- `yearsSincePlanted('2022-07-01', '2026-04-14')` = 3.
- `rotationYearEffective` returns stored value when present, derived for perennials, null otherwise.

### `backend/tests/usage-history-api.test.js` — integration, live server on :3001
- Empty list for virgin field.
- POST a period → 201, GET echoes it.
- POST overlapping period → 409 with conflict id.
- POST unknown usage → 400 with valid enum list.
- POST perennial with `rotation_year` → 201 with warning.
- PUT to shorten an active period (set `end_date`) → 200; new POST starting on that `end_date` → 201 (adjacency allowed).
- DELETE → 204, subsequent GET → empty.
- `GET /api/usage-history?as_of=2026-04-14` returns exactly one row per field with an active period, joined with geometry.
- `GET /api/usage-history?as_of=2023-01-01` returns only fields whose rooibos backfill covers that date.
- Seed idempotency: run seed twice, period count unchanged.
- `field_production.stand_pct` column absent after migration; value preserved on the corresponding period.

### Seed verification (manual, part of done)
- Count of periods active on `today` = count of fields with non-fallow enterprise in the 2026 reconciliation (+ fallow fields have explicit fallow periods too).
- Rooibos field B12 has a period `start_date='2022-01-01'`, `end_date=NULL`, `source='seed-rooibos-backfill'`.

## Known limitations / deferred

- **Field orientation & wind rows** — spec #1b.
- **Season-level granularity** (summer vs winter lupines on the same year) — the interval model can already express this via adjacent periods; no new schema required.
- **Cycle definition** (what makes a "3-year oats/lupines/fallow" cycle) — `rotation_year` is a free integer for now. A later spec may introduce `rotation_plan` entities.
- **Historical backfill for non-rooibos** — not available in DB, Excel, or wiki. Manual entries via the API as Alex remembers them, tracked by `source='manual'`.

## Files touched

New:
- `backend/src/db/schema-usage-periods.js`
- `backend/src/db/seed-usage-periods.js` (combines 2026 + rooibos backfill)
- `backend/src/services/usage.js`
- `backend/src/routes/usage.js`
- `backend/tests/usage-service.test.js`
- `backend/tests/usage-history-api.test.js`

Modified:
- `backend/src/db/schema.js` (wire new module)
- `backend/src/db/schema-farms.js` (drop `stand_pct` from `field_production` in a migration step)
- `backend/src/index.js` (mount new router, call new seed)
- `backend/src/routes/farms.js` (helper import for `refreshFieldCurrent` only, no route changes)
