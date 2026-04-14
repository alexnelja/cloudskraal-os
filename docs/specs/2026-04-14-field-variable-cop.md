# Spec 2a — Field-level variable COP + cost tagging

- **Date:** 2026-04-14
- **Status:** Design approved, pending implementation plan
- **Scope:** Backend — schema migrations (3 columns), service layer, route rewrite.
- **Out of scope (later specs in the COP chain):**
  - 2b: denominators & shrinkage (wet → dry kg)
  - 2c+2d: capital amortization & overhead allocation
  - 2e: rooibos processing cost centre
  - 2f: livestock COP
  - 2g: wine COP
  - 2h: reporting UI
- **Depends on:** Spec #1 (`field_usage_period`) — already shipped.

## Problem

The existing `GET /api/fields/:id/cost-of-production?year=Y` aggregates inputs, task-inputs, labour and yields keyed on `(field_id, date)`. It is usage-blind. After spec #1, a field can change usage mid-year (rooibos removed Mar, lupines planted May, next rooibos cycle following year), and costs/yields attributed to "the field in 2026" no longer make sense.

Additionally, the existing endpoint conflates all cost flavours — a bakkie-fuel charge (overhead), an establishment cost (capital), and a litre of herbicide (direct variable) all land in the same `total_cost`. Later specs need a way to separate these without changing how costs are written today.

## Goals

1. Split field-level COP by **usage** via the periods from spec #1.
2. Tag every cost event with a **`cost_category`** so future specs (overhead allocation, capital amortization, processing) can slice cleanly.
3. Attribute **yields** to a usage via explicit `harvest_date`, falling back to mid-year heuristic for legacy rows.
4. Surface a **`coverage`** block on every response stating what the number does *not* include, so the operator is never misled.
5. Keep write paths unchanged; all existing seeders and UI continue to work.

## Schema changes

```sql
-- field_production: new column for usage attribution of yields
ALTER TABLE field_production ADD COLUMN harvest_date TEXT;
CREATE INDEX idx_fprod_field_harvest ON field_production(field_id, harvest_date);

-- inventory_transactions: cost category tagging
ALTER TABLE inventory_transactions ADD COLUMN cost_category TEXT NOT NULL DEFAULT 'direct_variable';

-- time_entries: cost category tagging
ALTER TABLE time_entries ADD COLUMN cost_category TEXT NOT NULL DEFAULT 'direct_variable';
```

**Migration idempotency.** `ALTER TABLE ... ADD COLUMN` throws on second boot if the column exists. Each ALTER is wrapped in the same try-catch probe pattern used at `backend/src/db/schema-farms.js:73-78`:

```javascript
try {
  db.prepare("SELECT cost_category FROM inventory_transactions LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE inventory_transactions ADD COLUMN cost_category TEXT NOT NULL DEFAULT 'direct_variable'");
  console.log('  Migrated: added cost_category to inventory_transactions');
}
```

Same for `time_entries.cost_category` and `field_production.harvest_date`. The index uses `CREATE INDEX IF NOT EXISTS` — natively idempotent.

### `cost_category` enum

Source of truth: `backend/src/services/cop.js`.

| Value | Meaning | Consumed by spec |
|---|---|---|
| `direct_variable` | Crop-specific inputs/labour tied to a field-usage (default) | 2a |
| `overhead` | Shared/management costs — allocated later | 2c+2d |
| `establishment` | Capital cost of planting, amortized over crop life | 2c+2d |
| `processing` | Post-harvest (drying, cutting, bottling, shearing, etc.) | 2e |
| `internal_transfer` | Internal value flow, e.g. lupines hay → sheep feed | 2f |

Spec 2a **only reads** rows where `cost_category = 'direct_variable'`. All other rows stay in the database untouched and are picked up by their owning spec.

### `stand_pct` — stays on `field_production`

Unchanged from spec #1's decision. The existing rooibos replant logic at `routes/farms.js:246-298` continues to read it from there. Future work (potentially in spec 2b or later) revisits.

## Service — `backend/src/services/cop.js`

Single exported function:

```
computeFieldCop(db, fieldId, year) → CopReport
```

### CopReport shape

```typescript
type CopLine = {
  usage: string,               // 'rooibos' | 'lupines_fourrages' | 'oats' | ... | 'uncategorized'
  period_ids: string[],        // field_usage_period IDs for this usage that overlap the year
                               // on any day — included even if no transactions landed in them,
                               // so the operator sees the field *was* that usage at some point
  total_input_cost: number,    // sum of direct_variable inventory_transactions (type='usage')
  total_task_input_cost: number,
  total_labour_cost: number,   // hourly_rate × hours, or monthly_salary/176 × hours
  total_labour_hours: number,
  total_cost: number,          // sum of the three above
  area_ha: number,             // field.area_ha (static, same across lines — intentional)
  cost_per_ha: number,
  estimated_yield_kg: number,
  actual_yield_kg: number,
  yield_per_ha: number,
  cost_per_kg: number | null,  // null if actual_yield_kg == 0
  warnings: string[],          // e.g. 'harvest_date_missing_fallback_applied'
};

type CopReport = {
  field_id: string,
  year: number,
  lines: CopLine[],            // one per distinct usage with non-zero activity
                               // 'uncategorized' appears only if non-zero
  totals: {
    total_cost: number,        // sum of lines[*].total_cost
    total_yield_kg: number,    // sum of lines[*].actual_yield_kg
    uncategorized_cost: number,
  },
  coverage: {
    excludes: ['overhead', 'capital_amortization', 'processing', 'wet_to_dry_shrinkage'],
    denominator: 'raw_harvest_kg',
    notes: 'Field-level direct variable costs only. See future specs 2b–2h for full COP.',
  },
};
```

### Attribution rules

- **Period lookup:** for any date *d*, find the `field_usage_period` where `start_date <= d AND (end_date IS NULL OR end_date >= d) AND deleted_at IS NULL`. If multiple, pick most recent `start_date`. If none, the date is "in a gap".
- **`period_ids` per line:** includes every period of that usage that overlaps `[year-01-01, year-12-31]` on any day, regardless of whether transactions landed in it. A period spanning two years appears in both years' reports. A line with zero transactions but an active period shows an empty costs block and the `period_ids` populated, so the operator can still tell "the field was lupines here but no costs were recorded".
- **Inputs** (`inventory_transactions`): filter `field_id = ? AND type = 'usage' AND cost_category = 'direct_variable' AND date BETWEEN year-01-01 AND year-12-31`. Group by period → usage.
- **Task inputs** (`task_inputs` joined via `tasks.field_id`): date = `tasks.completed_date ?? tasks.due_date`. If neither is set (open task with no date), the task input is silently excluded from all reports — an open undated task has no time dimension to attribute cost to. This is a deliberate quiet exclusion; surfacing an `undated_tasks` tripwire is future work.
- **Labour** (`time_entries`): filter `field_id = ? AND cost_category = 'direct_variable' AND date BETWEEN year-01-01 AND year-12-31`. Labour cost = `hourly_rate × hours_worked`, else `(monthly_salary / 176) × hours_worked`.
- **Yields** (`field_production`): filter `field_id = ? AND year = ?`. Usage lookup uses `harvest_date` when present, else `${year}-06-30` (add warning `'harvest_date_missing_fallback_applied'` to the line).
- **Gap dates** → usage `'uncategorized'`. Produces a line with `period_ids: []`.

### Rotation/stand block untouched

`routes/farms.js:246-298` (the rooibos replant recommendation) is not modified by spec 2a. It still reads `field.enterprise`, `field.planted_year`, and `field_production.stand_pct`. Future spec (2b or later) revisits.

## Route rewrite

`GET /api/fields/:id/cost-of-production?year=Y` becomes a thin wrapper:

```
if (!year || isNaN(year)) return 400 { error: 'year_required' };
if (!field) return 404;
return 200 computeFieldCop(db, fieldId, Number(year));
```

**Breaking change:** response shape is now `CopReport` (object with `lines`, `totals`, `coverage`) rather than a single summary blob. The only known consumer is the field detail page; it is updated in the same PR. The implementation plan will grep `cost-of-production` across the frontend and add any other consumer it finds to the touched-files list.

## Error taxonomy

| Condition | HTTP | Body |
|---|---|---|
| Field not found | 404 | existing route behaviour |
| Missing/non-numeric `year` | 400 | `{error: 'year_required'}` |
| Field has no periods overlapping year | 200 | `lines: []`, zeroed totals, coverage present |
| Transaction in a gap | 200 | `uncategorized` line in `lines[]` + `totals.uncategorized_cost` |
| `harvest_date` null on a `field_production` row | 200 | fallback + line-level warning |
| `cost_category != 'direct_variable'` | 200 | row silently excluded |
| Yield zero | 200 | `cost_per_kg: null` |

## Testing (tests-first per Alex's standing preference)

### Unit — `backend/tests/cop-service.test.js` (in-memory SQLite)

- Single period, single input, single yield → one line with correct sums.
- Mid-year rotation (rooibos Jan-Mar, lupines May-Dec) with inputs on both sides → two lines.
- Input in a gap between periods → `uncategorized` line.
- Yield with null `harvest_date` → fallback to `year-06-30`, warning populated.
- `cost_category='overhead'` row present in DB → excluded from totals; `total_cost` unchanged.
- Soft-deleted period covering a date → that date is uncategorized.
- Zero actual yield → `cost_per_kg: null`.
- Empty field-year → `lines: []`, zeroed totals, coverage present.
- `coverage` object present on every response.

### Integration — `backend/tests/cost-of-production-api.test.js` (new file, live :3001)

- `GET /api/fields/:id/cost-of-production?year=2026` on a seeded rooibos field → 200 with rooibos line and coverage block.
- `GET /api/fields/:id/cost-of-production` without `year` → 400 `year_required`.
- `GET /api/fields/unknown/cost-of-production?year=2026` → 404.
- POST an `overhead`-tagged `inventory_transactions` row for the field + year; GET → that amount does NOT appear in `total_cost` (but the row exists in DB).
- Re-run the test file — idempotent (use sentinel years as in spec #1's test pattern).

### Schema migration smoke test (part of done)

Boot the server against an existing DB (not a fresh one). Verify:
- `PRAGMA table_info(field_production)` includes `harvest_date`.
- `PRAGMA table_info(inventory_transactions)` includes `cost_category` with `dflt_value='direct_variable'`.
- `PRAGMA table_info(time_entries)` includes `cost_category` with `dflt_value='direct_variable'`.
- Existing rows have `cost_category = 'direct_variable'` via the default.

## Known limitations / deferred

- **Overhead, capital, processing** — surfaced in `coverage.excludes`; specs 2c+2d and 2e address.
- **Denominator** — still `raw_harvest_kg`. Spec 2b introduces wet→dry conversion.
- **Sheep & wine** — separate specs (2f, 2g) with different cost-centre models.
- **Uncategorized prevention** — future improvement: prompt-on-write, small-gap auto-extension, per-transaction usage override, dashboard alert. Not in scope for 2a; `uncategorized` line is the current surface.
- **Revenue** — not computed. Needs a curated price source; future spec.

## Files touched

New:
- `backend/src/services/cop.js`
- `backend/src/db/migrate-field-cop.js` (runs the three ALTER TABLE + CREATE INDEX on boot, idempotently)
- `backend/tests/cop-service.test.js`
- `backend/tests/cost-of-production-api.test.js`

Modified:
- `backend/src/db/schema.js` — call the migration in `getDb`
- `backend/src/routes/farms.js` — rewrite the `/api/fields/:id/cost-of-production` handler as a wrapper around `computeFieldCop`; remove the now-duplicated aggregation logic at lines ~180-273
- `frontend/src/types/farm.ts` — replace `FieldCostOfProduction` with the new `CopReport` shape (`field_id`, `year`, `lines[]`, `totals`, `coverage`)
- `frontend/src/components/map/FieldPanel.tsx` (and any other consumer surfaced by grep) — render `lines[]` with a row per usage, `totals` as the page banner, and an `uncategorized` warning chip when `totals.uncategorized_cost > 0`. The implementation plan runs a grep for `cost-of-production` across `frontend/src/` and adds any additional files here before coding starts.
