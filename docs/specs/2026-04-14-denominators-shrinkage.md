# Spec 2b — Denominators & shrinkage

- **Date:** 2026-04-14
- **Status:** Design approved, pending implementation plan
- **Scope:** Backend — one new table, service additions, two new API endpoints, one existing endpoint extended.
- **Depends on:** Spec 2a (field-variable COP — `computeFieldCop`). Must ship after 2a.
- **Out of scope:** Per-batch shrinkage overrides (spec 2e), wine/sheep tier definitions (specs 2g/2f), stokke/stof byproduct accounting (spec 2e).

## Problem

Spec 2a returns `cost_per_kg` against `raw_harvest_kg`. That number is directionally wrong for rooibos, where the sellable unit is sifted netto dry, not wet harvest. 100 kg of wet harvest becomes ~45 kg dried, then ~39.15 kg netto. A cost-per-kg that divides by 100 understates the real unit cost by >2.5×.

The service has no way to convert harvest weight into downstream weights, no place to store the conversion factors, and no vocabulary for "sellable" that adapts to each enterprise.

## Goals

1. Store factor rows with effective dating: `(from_uom, to_uom, context, factor, effective_from)`.
2. Extend `computeFieldCop` with an optional `denominator` parameter (tier name or explicit UOM) that applies a BFS factor chain to yield before computing `cost_per_kg` / `yield_per_ha`.
3. Surface the factor chain used in the response (`coverage.factors_used`) so the UI can show how the number was derived.
4. Return 400 with the specific missing edge when the chain is incomplete. Never return a partial/guessed number.
5. Ship rooibos factors seeded from real Cloudskraal values. Wine/sheep wait for their own specs.

## Schema

```sql
CREATE TABLE conversion_factors (
  id             TEXT PRIMARY KEY,
  from_uom       TEXT NOT NULL,
  to_uom         TEXT NOT NULL,
  context        TEXT NOT NULL,    -- 'rooibos', 'wine_general', 'sheep', etc.
  factor         REAL NOT NULL,    -- multiplier: to_value = from_value * factor
  effective_from TEXT NOT NULL,    -- ISO date (YYYY-MM-DD), UTC
  notes          TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX idx_factors_lookup
  ON conversion_factors(from_uom, to_uom, context, effective_from);

-- Prevent ties at identical effective_from. POST returns 409 on duplicate;
-- future factor updates use a later effective_from.
CREATE UNIQUE INDEX idx_factors_unique
  ON conversion_factors(from_uom, to_uom, context, effective_from);
```

### Seed rows (effective_from = `2022-01-01`)

| from_uom | to_uom | context | factor | notes |
|---|---|---|---|---|
| harvest_wet_kg | dried_kg | rooibos | 0.45 | Typical drying shrink at Cloudskraal |
| dried_kg | sifted_netto_dry_kg | rooibos | 0.87 | 87% netto + 9% stokke + 4% stof |

### UOM vocabulary

No enum in the DB; free-text strings with a documented canonical list in `services/cop.js`. Rooibos-specific terminal UOMs introduced by seed:

- `harvest_wet_kg` — raw harvest weight at the field edge
- `dried_kg` — bruto weight off the dryer
- `sifted_netto_dry_kg` — after sifting; the sellable unit

Wine and sheep UOM chains exist conceptually (see `memory/domain_cloudskraal_terms.md`) but are seeded by specs 2g/2f.

### Effective dating & updates

- New factor for an existing `(from_uom, to_uom, context)` → insert a new row with a later `effective_from`. Old rows remain for historical queries.
- Factor lookup at time T picks the row with the largest `effective_from <= T` for that `(from, to, context)` triple.
- No mutation of existing rows except the `notes` field. This preserves audit trail for past COP reports.

## Service additions — `backend/src/services/cop.js`

### `resolveDenominator(usage, denominator)`

Maps a user-supplied value to a target UOM.

```javascript
// TIER_MAPS is hardcoded here for now. Specs 2f (sheep) and 2g (wine) extend it.
// If a fourth crop type lands (almonds, olives, buchu) reconsider moving this
// to a DB table so new tiers don't require a service-code change + deploy.
// Spec 2h (reporting UI) will probably want GET /api/tier-vocabularies to
// list available tiers per usage without hardcoding in the frontend.
const TIER_MAPS = {
  rooibos: {
    harvest: 'harvest_wet_kg',
    dried: 'dried_kg',
    netto_dry: 'sifted_netto_dry_kg',
  },
  // wine, sheep, ... added by specs 2g/2f
};

function resolveDenominator(usage, denominator) {
  if (!denominator) return null;  // caller wants default (harvest_wet_kg)
  const tierMap = TIER_MAPS[usage] ?? {};
  if (tierMap[denominator]) return tierMap[denominator];
  // Treat as explicit UOM if it looks like one (contains '_kg' or '_l' or similar heuristic,
  // OR appears in any known factor edge).
  return denominator;
}
```

Returning `denominator` verbatim when it doesn't match a tier means the factor-chain lookup will decide whether the UOM exists; a truly invalid value just produces `factor_missing`.

### `factorChain(db, from_uom, to_uom, context, asOf)`

BFS across factor edges effective at `asOf`. Returns either:
- `{ factor: number, path: [{from, to, factor}] }` — success, `factor` is the product along the path
- `{ error: 'factor_missing', missing_edge: 'X → Y' }` — at least one edge absent (the edge nearest the source is reported)

Cycle detection via visited set. Shortest-path preferred when multiple paths exist. `from === to` returns `{factor: 1, path: []}`.

Context resolution: the `context` parameter is the usage name (e.g. `'rooibos'`). Edges with a different context are ignored.

### `computeFieldCop(db, fieldId, year, opts)` — extended

New optional `opts.denominator` (string, tier or explicit UOM). When set:

1. For each `CopLine`, call `resolveDenominator(line.usage, opts.denominator)` → target UOM.
2. **Non-productive usage short-circuit:** if `line.usage ∈ {fallow, grazing, fallow_greening}`, skip factor resolution for this line. `cost_per_kg` stays null (yield is 0 anyway), and this line does not contribute to the all-or-nothing 400 in step 3.
3. Call `factorChain(db, 'harvest_wet_kg', target, line.usage, asOf)` where `asOf = ${year}-12-31` — end-of-year anchor.
4. If `factor_missing` on any productive line, the entire response is 400 with the error bubbled up — do NOT produce a partial report with mixed denominators. Rationale: returning "rooibos line shows cost-per-netto-dry-kg, lupines line shows cost-per-wet-kg" in the same response would silently mislead. Document as a known limitation in `coverage.notes` if it becomes painful (could add `?strict=false` in a later spec).
5. Otherwise: `converted_actual = round2(actual_yield_kg * factor)`, same for estimated. Raw `*_yield_kg` fields keep their original harvest-wet values; new `yield_in_denominator_kg` on each line holds the converted number. `cost_per_kg` and `yield_per_ha` are recomputed against the converted yield.
6. `coverage.denominator` = resolved target UOM.
7. `coverage.factors_used` = array `[{from, to, factor, context}]` from the path, **deduplicated by the tuple `(from_uom, to_uom, context, factor)`** so the same edge consumed by multiple lines appears once.

**`asOf = year-12-31` rationale.** End-of-year is chosen over start-of-year so that a factor refined mid-year (e.g. operator measured real shrinkage in July) retroactively applies to the whole year's report. Alex's farm operation treats the annual COP report as "what we know now about last year", not "what we thought at the start of the year". Trade-off: a report run mid-year uses factors in force at year-end, which for the *current* year means the latest row. Documented so no one is surprised.

**Rounding.** All converted yields and derived numbers (`cost_per_kg`, `yield_per_ha`, `cost_per_ha`) are rounded to 2 decimals via `Math.round(x * 100) / 100`. Matches spec 2a's convention.

When `opts.denominator` is absent, behaviour is exactly as spec 2a — no factor lookup, `coverage.denominator = 'raw_harvest_kg'`, no `factors_used` field.

## API

### Existing endpoint extended

`GET /api/fields/:id/cost-of-production?year=Y[&denominator=X]`

- `X` absent → spec 2a behaviour.
- `X = 'harvest' | 'dried' | 'netto_dry'` (tier) — resolved per the usage of each line.
- `X` matches a known UOM (e.g. `sifted_netto_dry_kg`) — used verbatim.
- Unknown/unreachable → 400 `invalid_denominator` or `factor_missing` as described.

### New endpoints

```
GET /api/conversion-factors?context=rooibos[&as_of=YYYY-MM-DD]
   → [{id, from_uom, to_uom, context, factor, effective_from, notes}]

   Returns the currently-effective (or historical, if as_of given) factor set
   for the given context. as_of defaults to todayUTC().

POST /api/conversion-factors
   body: {from_uom, to_uom, context, factor, effective_from, notes?}
   → 201 {id, ...}

   Creates a new factor row. Old rows remain (effective dating).
   Validation: factor > 0, effective_from is a valid ISO date, all required
   fields present.
```

## Error taxonomy

| Condition | HTTP | Body |
|---|---|---|
| `denominator` provided but resolves to nothing known | 400 | `{error: 'invalid_denominator', value}` |
| Factor chain has a missing edge | 400 | `{error: 'factor_missing', missing_edge: 'X → Y', context}` |
| POST factor with `factor <= 0` | 400 | `{error: 'invalid_factor'}` |
| POST factor with invalid `effective_from` (not parseable ISO date) | 400 | `{error: 'invalid_date'}` |
| POST factor missing required field | 400 | `{error: 'missing_field', field}` |
| POST factor duplicating an existing `(from, to, context, effective_from)` row | 409 | `{error: 'duplicate_factor', hint: 'use a later effective_from'}` |

**Security note.** Cloudskraal is a single-tenant, local-network app; the backend runs on localhost. POST `/api/conversion-factors` has no auth — consistent with every other POST in the codebase. If the deployment surface ever broadens, this endpoint (along with everything else) needs an auth layer; spec 2b does not introduce one.

Factor chains are per-line, but the response is all-or-nothing. If any line's chain is broken the whole endpoint 400s. Rationale: mixing lines against different denominators would mislead the operator.

## Data flow

```
 writes (manual + seed)        reads (spec 2b)
 ────────────────────          ─────────────────
 POST /conversion-factors      GET /cost-of-production?denominator=X
          │                           │
          ▼                           ▼
 conversion_factors table     computeFieldCop(db, id, year, {denominator: X})
                                     │
                                     ├─► resolveDenominator(usage, X) → target UOM
                                     ├─► factorChain(db, harvest_wet_kg, target,
                                     │                 usage, year-12-31)
                                     ├─► multiply yields by factor
                                     └─► populate coverage.factors_used
```

## Testing (tests-first)

### Unit — append to `backend/tests/cop-service.test.js`

- `resolveDenominator('rooibos', 'netto_dry')` → `'sifted_netto_dry_kg'`.
- `resolveDenominator('rooibos', 'sifted_netto_dry_kg')` → `'sifted_netto_dry_kg'` (pass-through).
- `resolveDenominator('rooibos', 'nonsense')` → `'nonsense'` (pass-through; lookup fails later).
- `factorChain(db, 'harvest_wet_kg', 'dried_kg', 'rooibos', '2026-12-31')` → `{factor: 0.45, path: [...]}`.
- `factorChain` two-hop (`harvest_wet_kg` → `sifted_netto_dry_kg`) → `{factor: 0.3915, path: [2 edges]}`.
- `factorChain` with missing intermediate → `{error: 'factor_missing', missing_edge: ...}`.
- `factorChain` honours `asOf` — a future-dated factor row is not used for a past query.
- `computeFieldCop` with `denominator='netto_dry'` on rooibos → `cost_per_kg` against converted yield; `coverage.factors_used` populated.
- `computeFieldCop` with unreachable denominator → 400 (tested via the route; service returns error shape).

### Integration — new file `backend/tests/conversion-factors-api.test.js`

- `GET /api/conversion-factors?context=rooibos` returns seeded rows.
- `POST /api/conversion-factors` with valid payload → 201, GET reflects new row.
- `POST` with `factor=0` → 400 `invalid_factor`.
- `POST` with missing `from_uom` → 400 `missing_field`.
- `GET /api/conversion-factors?context=rooibos&as_of=2020-01-01` returns empty (factors effective from 2022).

### Integration — append to `backend/tests/cost-of-production-api.test.js`

- `GET /api/fields/:id/cost-of-production?year=2026&denominator=netto_dry` for a rooibos field → 200, `coverage.denominator === 'sifted_netto_dry_kg'`, `cost_per_kg` equals spec 2a's value divided by `0.45 * 0.87`.
- Same with `?denominator=dried` → `cost_per_kg` divided by `0.45`.
- `?denominator=bogus` → 400 `factor_missing`.
- Factor-missing cleanup: sentinel `bogus_uom` rows cleaned in `afterAll`.

## Migration & backward compatibility

- `conversion_factors` is a new table. Fresh DB creation runs via `initConversionFactorsSchema(db)` wired into `schema.js`. The `CREATE TABLE IF NOT EXISTS` form is natively idempotent on repeated boots.
- Seed idempotency: `seedConversionFactors(db)` checks `SELECT COUNT(*) FROM conversion_factors WHERE context='rooibos' AND effective_from='2022-01-01'`. If the canonical rooibos seed rows exist, skip. Running the seed twice on the same DB is a no-op. Adding new factors (via POST) does not trigger re-seeding.
- Existing callers (spec 2a field panel) continue working because `denominator` is optional; omitting it preserves spec 2a behaviour exactly.
- `coverage.denominator` changes from a static `'raw_harvest_kg'` string to the resolved UOM — already a string, no type change.

## Files touched

New:
- `backend/src/db/schema-conversion-factors.js`
- `backend/src/db/seed-conversion-factors.js`
- `backend/src/routes/conversion-factors.js`
- `backend/tests/conversion-factors-api.test.js`

Modified:
- `backend/src/db/schema.js` — wire the new schema
- `backend/src/index.js` — mount router, call seed
- `backend/src/services/cop.js` — add `resolveDenominator`, `factorChain`, extend `computeFieldCop`
- `backend/tests/cop-service.test.js` — append unit tests
- `backend/tests/cost-of-production-api.test.js` — append integration tests

No frontend changes in spec 2b. The UI gets the new capability the moment it opts in by passing `&denominator=X`; UI polish (selector buttons, per-enterprise tier hints) is spec 2h.

## Known limitations / deferred

- **Per-batch actual shrinkage** — averaged out here. Spec 2e introduces processing batches where wet-in and dry-out are measured; those values override the default factor for that batch's contribution.
- **Stokke & stof byproducts** — sifted out but not modelled as byproduct value in 2b. Spec 2e decides whether they become revenue lines or remain pure losses. Stokke in particular are recirculated ("reprocessed through a corn cutter and fed back into the next day's processing") — the processing model must handle this without double-counting.
- **Wine and sheep UOM chains** — defined in `memory/domain_cloudskraal_terms.md` but not seeded here. Specs 2g (wine) and 2f (livestock) introduce their factor rows and tier maps.
- **UI** — none in 2b. Spec 2h adds denominator selector, factors-used drawer.
