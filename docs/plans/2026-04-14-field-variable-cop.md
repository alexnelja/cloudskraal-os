# Field-Variable COP + Cost Tagging Implementation Plan (Spec 2a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `/api/fields/:id/cost-of-production` to split costs and yields by usage (rooibos vs lupines vs ...), tag every cost row with a `cost_category` for future specs, and surface a `coverage` block that honestly lists what the number excludes.

**Architecture:** Three additive schema migrations (idempotent via try-catch probes like `schema-farms.js:73`). A new `services/cop.js` owns the aggregation. The route becomes a thin wrapper calling `computeFieldCop`. Each `CopLine` carries both totals and the detail arrays (inputs/task_inputs/labour/production) so the existing field panel UI doesn't regress. `rotation` (rooibos replant block) moves verbatim into the new report shape at the top level.

**Tech Stack:** Node.js + Express, better-sqlite3 (WAL), vitest (live server on :3001). TDD — see failing test, implement, pass, commit.

**Spec:** `docs/specs/2026-04-14-field-variable-cop.md`

**Spec #1 foundations used:** `services/usage.js` (`USAGE_TYPES`, period lookup), `field_usage_period` table, `utils/dates.js` (`todayUTC`).

**Out of scope** (handled by specs 2b/2c/2d/2e/2f/2g/2h): denominators, overhead, amortization, processing, livestock, wine, reporting UI.

---

## File structure

**New:**
- `backend/src/db/migrate-field-cop.js` — three idempotent ALTER TABLEs + index
- `backend/src/services/cop.js` — `computeFieldCop(db, fieldId, year)` + helpers
- `backend/tests/cop-service.test.js` — unit
- `backend/tests/cost-of-production-api.test.js` — integration on :3001

**Modified:**
- `backend/src/db/schema.js` — call migration in `getDb()`
- `backend/src/routes/farms.js` — replace lines 162-298 (cost-of-production handler) with a thin wrapper; move the rotation/stand helper into a small `computeFieldRotation(db, field)` function used by the service
- `frontend/src/types/farm.ts` — replace `FieldCostOfProduction` interface with the new `CopReport` shape; add `CopLine`, `CopCoverage` types
- `frontend/src/components/map/FieldPanel.tsx` — render `lines[]` (one block per usage) instead of a single flat summary; add the `coverage` caveat chip and `uncategorized` warning

---

## Implementer notes

- **Working directory for all backend commands:** `/Users/alexnelja/projects/cloudskraal-capex/backend`.
- **Working directory for frontend:** `/Users/alexnelja/projects/cloudskraal-capex/frontend`.
- Tests ESM, source CJS (vitest transforms). See `wiki-api.test.js` for integration pattern, `usage-service.test.js` for in-memory DB pattern.
- Server must run on :3001 for integration tests. Kill any old listener before starting (`lsof -ti:3001 | xargs kill 2>/dev/null`).
- Frontend type changes break the field panel — tasks 6-7 finish the loop; don't stop after the backend route change.

---

## Task 1: Migration module + schema wire-up

**Files:**
- Create: `backend/src/db/migrate-field-cop.js`
- Modify: `backend/src/db/schema.js`
- Test: `backend/tests/cop-service.test.js` (schema probe portion only)

- [ ] **Step 1: Write failing schema probe**

Create `backend/tests/cop-service.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';

function setupDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);
  initCalendarSchema(db);
  initPhase3Schema(db);
  migrateFieldCop(db);
  return db;
}

describe('migrate-field-cop', () => {
  it('adds harvest_date to field_production', () => {
    const db = setupDb();
    const cols = db.prepare('PRAGMA table_info(field_production)').all();
    expect(cols.some(c => c.name === 'harvest_date')).toBe(true);
    db.close();
  });

  it('adds cost_category to inventory_transactions with default direct_variable', () => {
    const db = setupDb();
    const cols = db.prepare('PRAGMA table_info(inventory_transactions)').all();
    const col = cols.find(c => c.name === 'cost_category');
    expect(col).toBeTruthy();
    expect(col.dflt_value).toBe("'direct_variable'");
    db.close();
  });

  it('adds cost_category to time_entries with default direct_variable', () => {
    const db = setupDb();
    const cols = db.prepare('PRAGMA table_info(time_entries)').all();
    const col = cols.find(c => c.name === 'cost_category');
    expect(col).toBeTruthy();
    db.close();
  });

  it('is idempotent — second run does not throw', () => {
    const db = setupDb();
    expect(() => migrateFieldCop(db)).not.toThrow();
    db.close();
  });

  it('creates idx_fprod_field_harvest', () => {
    const db = setupDb();
    const idx = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='field_production'"
    ).all().map(r => r.name);
    expect(idx).toContain('idx_fprod_field_harvest');
    db.close();
  });
});
```

- [ ] **Step 2: Confirm it fails**

Run: `npx vitest run tests/cop-service.test.js`
Expected: FAIL — `migrate-field-cop.js` not found.

- [ ] **Step 3: Implement the migration module**

Create `backend/src/db/migrate-field-cop.js`:

```javascript
function probeAndAdd(db, table, column, ddl, indexDdl) {
  try {
    db.prepare(`SELECT ${column} FROM ${table} LIMIT 1`).get();
  } catch (e) {
    db.exec(ddl);
    console.log(`  Migrated: added ${column} to ${table}`);
  }
  if (indexDdl) db.exec(indexDdl);
}

function migrateFieldCop(db) {
  probeAndAdd(
    db, 'field_production', 'harvest_date',
    'ALTER TABLE field_production ADD COLUMN harvest_date TEXT',
    'CREATE INDEX IF NOT EXISTS idx_fprod_field_harvest ON field_production(field_id, harvest_date)'
  );
  probeAndAdd(
    db, 'inventory_transactions', 'cost_category',
    "ALTER TABLE inventory_transactions ADD COLUMN cost_category TEXT NOT NULL DEFAULT 'direct_variable'",
  );
  probeAndAdd(
    db, 'time_entries', 'cost_category',
    "ALTER TABLE time_entries ADD COLUMN cost_category TEXT NOT NULL DEFAULT 'direct_variable'",
  );
}

module.exports = { migrateFieldCop };
```

- [ ] **Step 4: Wire into `schema.js`**

In `backend/src/db/schema.js`:
- After the other `const { init...Schema }` lines, add:
  `const { migrateFieldCop } = require('./migrate-field-cop');`
- In `getDb()`, after all `init*Schema(db)` calls, add:
  `migrateFieldCop(db);`

- [ ] **Step 5: Confirm tests pass**

Run: `npx vitest run tests/cop-service.test.js`
Expected: 5 passed.

- [ ] **Step 6: Boot against the existing dev DB (NOT a fresh DB) to confirm idempotency on real data**

```bash
PORT=3099 node src/index.js > /tmp/ck.log 2>&1 &
sleep 3
curl -sS http://localhost:3099/api/health
kill %1 2>/dev/null; wait 2>/dev/null
grep "Migrated:" /tmp/ck.log
sqlite3 data/capex.db "SELECT COUNT(*) FROM inventory_transactions WHERE cost_category='direct_variable';"
```

Expected: `/api/health` OK. Either first-time migration logs appear, or they don't (already applied). The SQL count matches the total row count of `inventory_transactions` (defaulted).

- [ ] **Step 7: Commit**

```bash
git add backend/src/db/migrate-field-cop.js backend/src/db/schema.js backend/tests/cop-service.test.js
git commit -m "feat(cloudskraal): migrate — harvest_date + cost_category columns"
```

---

## Task 2: COP service scaffold — period lookup for a date

**Files:**
- Create: `backend/src/services/cop.js`
- Test: append to `backend/tests/cop-service.test.js`

Small first step: the primitive every aggregation leans on — given a date, find the usage via periods.

- [ ] **Step 1: Append failing test**

Append to `backend/tests/cop-service.test.js`:

```javascript
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { usageOnDate } from '../src/services/cop.js';

function seedField(db) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1','Test','t','owned',now,now);
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`)
    .run('fld1','farm1','F1','unclassified','{}',now,now);
}

function seedPeriod(db, args) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO field_usage_period
    (id,field_id,usage,start_date,end_date,planted_date,source,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
      args.id, args.field_id, args.usage, args.start_date, args.end_date ?? null,
      args.planted_date ?? null, args.source ?? 'seed', now, now
    );
}

describe('usageOnDate', () => {
  it('returns the usage active on the date', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    expect(usageOnDate(db, 'fld1', '2026-04-14')).toEqual({
      usage: 'rooibos', period_id: 'p1'
    });
    db.close();
  });

  it('returns null when in a gap', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: '2024-01-01' });
    expect(usageOnDate(db, 'fld1', '2026-04-14')).toBeNull();
    db.close();
  });

  it('ignores soft-deleted periods', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    const now = new Date().toISOString();
    db.prepare('UPDATE field_usage_period SET deleted_at=? WHERE id=?').run(now, 'p1');
    expect(usageOnDate(db, 'fld1', '2026-04-14')).toBeNull();
    db.close();
  });

  it('picks most recent start_date when multiple overlap', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: '2026-03-31' });
    seedPeriod(db, { id: 'p2', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2026-04-01', end_date: null });
    expect(usageOnDate(db, 'fld1', '2026-05-01')).toEqual({
      usage: 'lupines_fourrages', period_id: 'p2'
    });
    db.close();
  });
});
```

- [ ] **Step 2: Confirm it fails**

Run: `npx vitest run tests/cop-service.test.js`
Expected: FAIL — `usageOnDate` not exported.

- [ ] **Step 3: Implement**

Create `backend/src/services/cop.js`:

```javascript
function usageOnDate(db, fieldId, dateStr) {
  const row = db.prepare(`
    SELECT id AS period_id, usage
      FROM field_usage_period
     WHERE field_id = ?
       AND deleted_at IS NULL
       AND start_date <= ?
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY start_date DESC
     LIMIT 1
  `).get(fieldId, dateStr, dateStr);
  return row ? { usage: row.usage, period_id: row.period_id } : null;
}

module.exports = { usageOnDate };
```

- [ ] **Step 4: Pass**

Run: `npx vitest run tests/cop-service.test.js`
Expected: all green (9 tests total: 5 schema + 4 new).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/cop.js backend/tests/cop-service.test.js
git commit -m "feat(cloudskraal): cop service — usageOnDate primitive"
```

---

## Task 3: `periodsOverlappingYear`

**Files:**
- Modify: `backend/src/services/cop.js`
- Test: append to `backend/tests/cop-service.test.js`

- [ ] **Step 1: Append failing test**

```javascript
import { periodsOverlappingYear } from '../src/services/cop.js';

describe('periodsOverlappingYear', () => {
  it('returns periods that touch the year', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    seedPeriod(db, { id: 'p2', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2020-05-01', end_date: '2020-12-31' });
    // NOTE: p1 and p2 overlap in time (p1 start=2022, p2 end=2020). Different test —
    // this test uses only p1 + a 2028 query. Simpler reset:
    db.prepare('DELETE FROM field_usage_period WHERE id=?').run('p2');
    const rows = periodsOverlappingYear(db, 'fld1', 2026);
    expect(rows.map(r => r.id)).toEqual(['p1']);
    db.close();
  });

  it('includes periods that span two years', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2025-11-01', end_date: '2026-06-30' });
    const in2025 = periodsOverlappingYear(db, 'fld1', 2025).map(r => r.id);
    const in2026 = periodsOverlappingYear(db, 'fld1', 2026).map(r => r.id);
    expect(in2025).toContain('p1');
    expect(in2026).toContain('p1');
    db.close();
  });

  it('excludes soft-deleted', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    const now = new Date().toISOString();
    db.prepare('UPDATE field_usage_period SET deleted_at=? WHERE id=?').run(now, 'p1');
    expect(periodsOverlappingYear(db, 'fld1', 2026)).toEqual([]);
    db.close();
  });
});
```

- [ ] **Step 2: Confirm fail.** Run: `npx vitest run tests/cop-service.test.js`.

- [ ] **Step 3: Implement**

Append to `backend/src/services/cop.js`:

```javascript
function periodsOverlappingYear(db, fieldId, year) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  return db.prepare(`
    SELECT id, usage, start_date, end_date, planted_date, source
      FROM field_usage_period
     WHERE field_id = ?
       AND deleted_at IS NULL
       AND start_date <= ?
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY start_date ASC
  `).all(fieldId, yearEnd, yearStart);
}

module.exports.periodsOverlappingYear = periodsOverlappingYear;
```

- [ ] **Step 4: Pass.** `npx vitest run tests/cop-service.test.js`

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/cop.js backend/tests/cop-service.test.js
git commit -m "feat(cloudskraal): cop service — periodsOverlappingYear"
```

---

## Task 4: `computeFieldCop` — aggregation engine

**Files:**
- Modify: `backend/src/services/cop.js`
- Test: append to `backend/tests/cop-service.test.js`

This is the biggest task. Writing the full failing test suite first, then implement to pass.

- [ ] **Step 1: Append failing integration test (pure in-memory DB, no HTTP)**

Add these helpers at the top of the `describe('computeFieldCop', ...)` block:

```javascript
import { computeFieldCop } from '../src/services/cop.js';
import { initPhase3Schema as _iP3 } from '../src/db/schema-phase3.js';  // already imported

function seedInput(db, args) {
  const now = new Date().toISOString();
  // Ensure input_products row exists
  try {
    db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?)`).run(args.product_id, args.product_name ?? 'X', 'fertilizer', 'kg', 10, now, now);
  } catch {}
  db.prepare(`INSERT INTO inventory_transactions
    (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      args.id, args.product_id, 'usage', args.date, args.quantity ?? 1,
      args.unit_cost ?? 10, args.total_cost, args.field_id,
      args.cost_category ?? 'direct_variable', now
    );
}

function seedLabour(db, args) {
  const now = new Date().toISOString();
  try {
    db.prepare(`INSERT INTO employees (id,name,role,hourly_rate,monthly_salary,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?)`).run('emp1','Japie','field_worker',50,null,now,now);
  } catch {}
  db.prepare(`INSERT INTO time_entries
    (id,employee_id,date,hours_worked,field_id,cost_category,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(
      args.id, 'emp1', args.date, args.hours, args.field_id,
      args.cost_category ?? 'direct_variable', now
    );
}

function seedProduction(db, args) {
  db.prepare(`INSERT INTO field_production
    (id,field_id,year,estimated_yield_kg,actual_yield_kg,harvest_date,stand_pct,notes)
    VALUES (?,?,?,?,?,?,?,?)`).run(
      args.id, args.field_id, args.year,
      args.estimated ?? null, args.actual ?? null,
      args.harvest_date ?? null, args.stand_pct ?? null, args.notes ?? null
    );
}

describe('computeFieldCop', () => {
  function setup() {
    const db = setupDb();                       // runs migrateFieldCop
    initUsagePeriodsSchema(db);
    seedField(db);
    db.prepare(`UPDATE fields SET area_ha=10 WHERE id='fld1'`).run();
    return db;
  }

  it('returns shape with field, lines, totals, rotation, coverage', () => {
    const db = setup();
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.field_id).toBe('fld1');
    expect(r.year).toBe(2026);
    expect(Array.isArray(r.lines)).toBe(true);
    expect(r.totals).toHaveProperty('total_cost');
    expect(r.coverage.excludes).toContain('overhead');
    expect(r.coverage.denominator).toBe('raw_harvest_kg');
    db.close();
  });

  it('single period, single input, single yield → one line, correct sums', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null, planted_date:'2022-01-01' });
    seedInput(db, { id:'i1', product_id:'prod1', field_id:'fld1',
      date:'2026-05-01', total_cost:100 });
    seedProduction(db, { id:'y1', field_id:'fld1', year:2026,
      actual:500, harvest_date:'2026-02-15' });
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.lines).toHaveLength(1);
    const line = r.lines[0];
    expect(line.usage).toBe('rooibos');
    expect(line.total_input_cost).toBe(100);
    expect(line.total_cost).toBe(100);
    expect(line.actual_yield_kg).toBe(500);
    expect(line.cost_per_kg).toBe(0.2);
    expect(line.area_ha).toBe(10);
    expect(line.cost_per_ha).toBe(10);
    expect(r.totals.total_cost).toBe(100);
    db.close();
  });

  it('mid-year rotation → two lines, costs split by date', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:'2026-03-31' });
    seedPeriod(db, { id:'p2', field_id:'fld1', usage:'lupines_fourrages',
      start_date:'2026-05-01', end_date:'2026-12-31' });
    seedInput(db, { id:'i1', product_id:'prod1', field_id:'fld1',
      date:'2026-02-10', total_cost:50 });  // rooibos
    seedInput(db, { id:'i2', product_id:'prod1', field_id:'fld1',
      date:'2026-06-01', total_cost:80 });  // lupines
    const r = computeFieldCop(db, 'fld1', 2026);
    const rooibos = r.lines.find(l => l.usage === 'rooibos');
    const lupines = r.lines.find(l => l.usage === 'lupines_fourrages');
    expect(rooibos.total_input_cost).toBe(50);
    expect(lupines.total_input_cost).toBe(80);
    expect(r.totals.total_cost).toBe(130);
    expect(r.totals.uncategorized_cost).toBe(0);
    db.close();
  });

  it('input in a gap → uncategorized line', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:'2026-01-31' });
    seedInput(db, { id:'i1', product_id:'prod1', field_id:'fld1',
      date:'2026-07-15', total_cost:40 });
    const r = computeFieldCop(db, 'fld1', 2026);
    const unc = r.lines.find(l => l.usage === 'uncategorized');
    expect(unc).toBeTruthy();
    expect(unc.total_input_cost).toBe(40);
    expect(r.totals.uncategorized_cost).toBe(40);
    db.close();
  });

  it('yield with null harvest_date → fallback to mid-year, warning added', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null });
    seedProduction(db, { id:'y1', field_id:'fld1', year:2026, actual:300 });  // no harvest_date
    const r = computeFieldCop(db, 'fld1', 2026);
    const rooibos = r.lines.find(l => l.usage === 'rooibos');
    expect(rooibos.actual_yield_kg).toBe(300);
    expect(rooibos.warnings).toContain('harvest_date_missing_fallback_applied');
    db.close();
  });

  it('cost_category=overhead is excluded from totals', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null });
    seedInput(db, { id:'i1', product_id:'prod1', field_id:'fld1',
      date:'2026-05-01', total_cost:100, cost_category:'direct_variable' });
    seedInput(db, { id:'i2', product_id:'prod1', field_id:'fld1',
      date:'2026-05-01', total_cost:999, cost_category:'overhead' });
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.totals.total_cost).toBe(100);
    db.close();
  });

  it('empty field-year returns lines=[] and zeroed totals, coverage present', () => {
    const db = setup();
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.lines).toEqual([]);
    expect(r.totals).toEqual({ total_cost:0, total_yield_kg:0, uncategorized_cost:0 });
    expect(r.coverage).toBeTruthy();
    db.close();
  });

  it('line with overlapping period but no transactions still appears', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null });
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.lines).toHaveLength(1);
    const line = r.lines[0];
    expect(line.usage).toBe('rooibos');
    expect(line.period_ids).toEqual(['p1']);
    expect(line.total_cost).toBe(0);
    db.close();
  });

  it('labour cost uses hourly_rate × hours', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null });
    seedLabour(db, { id:'t1', field_id:'fld1', date:'2026-05-01', hours:8 });
    const r = computeFieldCop(db, 'fld1', 2026);
    const line = r.lines[0];
    expect(line.total_labour_hours).toBe(8);
    expect(line.total_labour_cost).toBe(400);  // 50 * 8
    expect(line.total_cost).toBe(400);
    db.close();
  });

  it('zero yield → cost_per_kg null', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null });
    seedInput(db, { id:'i1', product_id:'prod1', field_id:'fld1',
      date:'2026-05-01', total_cost:100 });
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.lines[0].cost_per_kg).toBeNull();
    db.close();
  });
});
```

- [ ] **Step 2: Confirm fail.** `npx vitest run tests/cop-service.test.js` — many failures on `computeFieldCop`.

- [ ] **Step 3: Implement the aggregator**

Append to `backend/src/services/cop.js`:

```javascript
const UNCAT = 'uncategorized';

const COVERAGE = {
  excludes: ['overhead', 'capital_amortization', 'processing', 'wet_to_dry_shrinkage'],
  denominator: 'raw_harvest_kg',
  notes: 'Field-level direct variable costs only. See future specs 2b–2h for full COP.',
};

function emptyLine(usage, area_ha) {
  return {
    usage,
    period_ids: [],
    inputs: [],
    task_inputs: [],
    labour: [],
    production: [],
    total_input_cost: 0,
    total_task_input_cost: 0,
    total_labour_cost: 0,
    total_labour_hours: 0,
    total_cost: 0,
    area_ha,
    cost_per_ha: 0,
    estimated_yield_kg: 0,
    actual_yield_kg: 0,
    yield_per_ha: 0,
    cost_per_kg: null,
    warnings: [],
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

function computeFieldCop(db, fieldId, year) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const field = db.prepare(`
    SELECT fi.*, f.name AS farm_name
      FROM fields fi
      LEFT JOIN farms f ON f.id = fi.farm_id
     WHERE fi.id = ?
  `).get(fieldId);
  if (!field) return null;

  const area_ha = field.area_ha || 1;

  // Seed lines from any period overlapping the year (even zero-activity).
  const periods = periodsOverlappingYear(db, fieldId, year);
  const linesByUsage = new Map();
  for (const p of periods) {
    if (!linesByUsage.has(p.usage)) linesByUsage.set(p.usage, emptyLine(p.usage, area_ha));
    linesByUsage.get(p.usage).period_ids.push(p.id);
  }

  function getOrCreateLine(usage) {
    if (!linesByUsage.has(usage)) linesByUsage.set(usage, emptyLine(usage, area_ha));
    return linesByUsage.get(usage);
  }

  // Inputs (inventory_transactions, type='usage', direct_variable, in year)
  const inputs = db.prepare(`
    SELECT t.*, p.name AS product_name, p.category, p.unit_of_measure
      FROM inventory_transactions t
      LEFT JOIN input_products p ON p.id = t.product_id
     WHERE t.field_id = ?
       AND t.type = 'usage'
       AND t.cost_category = 'direct_variable'
       AND t.date >= ? AND t.date <= ?
     ORDER BY t.date DESC
  `).all(fieldId, yearStart, yearEnd);
  for (const i of inputs) {
    const hit = usageOnDate(db, fieldId, i.date);
    const usage = hit?.usage ?? UNCAT;
    const line = getOrCreateLine(usage);
    line.inputs.push(i);
    line.total_input_cost += i.total_cost || 0;
  }

  // Task inputs (via tasks with field_id and a date)
  const taskInputs = db.prepare(`
    SELECT ti.*, t.title AS task_title, t.due_date, t.completed_date, t.status AS task_status
      FROM task_inputs ti
      JOIN tasks t ON t.id = ti.task_id
     WHERE t.field_id = ?
       AND (
         (t.completed_date IS NOT NULL AND t.completed_date >= ? AND t.completed_date <= ?)
         OR (t.completed_date IS NULL AND t.due_date IS NOT NULL AND t.due_date >= ? AND t.due_date <= ?)
       )
     ORDER BY COALESCE(t.completed_date, t.due_date) DESC
  `).all(fieldId, yearStart, yearEnd, yearStart, yearEnd);
  for (const ti of taskInputs) {
    const d = ti.completed_date || ti.due_date;
    if (!d) continue;  // no date => silently excluded per spec
    const hit = usageOnDate(db, fieldId, d);
    const usage = hit?.usage ?? UNCAT;
    const line = getOrCreateLine(usage);
    line.task_inputs.push(ti);
    line.total_task_input_cost += ti.total_cost || 0;
  }

  // Labour (time_entries, direct_variable)
  const labour = db.prepare(`
    SELECT te.*, e.name AS employee_name, e.role AS employee_role,
           e.hourly_rate, e.monthly_salary
      FROM time_entries te
      LEFT JOIN employees e ON e.id = te.employee_id
     WHERE te.field_id = ?
       AND te.cost_category = 'direct_variable'
       AND te.date >= ? AND te.date <= ?
     ORDER BY te.date DESC
  `).all(fieldId, yearStart, yearEnd);
  for (const te of labour) {
    const hit = usageOnDate(db, fieldId, te.date);
    const usage = hit?.usage ?? UNCAT;
    const line = getOrCreateLine(usage);
    line.labour.push(te);
    const hours = te.hours_worked || 0;
    const cost = te.hourly_rate
      ? hours * te.hourly_rate
      : (te.monthly_salary ? hours * (te.monthly_salary / 176) : 0);
    line.total_labour_cost += cost;
    line.total_labour_hours += hours;
  }

  // Yields (field_production for the year)
  const production = db.prepare(`
    SELECT * FROM field_production WHERE field_id = ? AND year = ?
  `).all(fieldId, year);
  for (const yrow of production) {
    let usage, addFallback = false;
    if (yrow.harvest_date) {
      const hit = usageOnDate(db, fieldId, yrow.harvest_date);
      usage = hit?.usage ?? UNCAT;
    } else {
      const hit = usageOnDate(db, fieldId, `${year}-06-30`);
      usage = hit?.usage ?? UNCAT;
      addFallback = true;
    }
    const line = getOrCreateLine(usage);
    line.production.push(yrow);
    line.estimated_yield_kg += yrow.estimated_yield_kg || 0;
    line.actual_yield_kg += yrow.actual_yield_kg || 0;
    if (addFallback && !line.warnings.includes('harvest_date_missing_fallback_applied')) {
      line.warnings.push('harvest_date_missing_fallback_applied');
    }
  }

  // Finalize each line (totals, per-ha, per-kg, rounding)
  const lines = [];
  for (const line of linesByUsage.values()) {
    line.total_cost = round2(line.total_input_cost + line.total_task_input_cost + line.total_labour_cost);
    line.total_input_cost = round2(line.total_input_cost);
    line.total_task_input_cost = round2(line.total_task_input_cost);
    line.total_labour_cost = round2(line.total_labour_cost);
    line.total_labour_hours = Math.round(line.total_labour_hours * 10) / 10;
    line.cost_per_ha = round2(line.total_cost / area_ha);
    line.yield_per_ha = round2(line.actual_yield_kg / area_ha);
    line.cost_per_kg = line.actual_yield_kg > 0 ? round2(line.total_cost / line.actual_yield_kg) : null;
    line.estimated_yield_kg = round2(line.estimated_yield_kg);
    line.actual_yield_kg = round2(line.actual_yield_kg);
    // Drop uncategorized with zero activity
    if (line.usage === UNCAT && line.total_cost === 0
        && line.estimated_yield_kg === 0 && line.actual_yield_kg === 0) continue;
    lines.push(line);
  }

  const totals = {
    total_cost: round2(lines.reduce((s, l) => s + l.total_cost, 0)),
    total_yield_kg: round2(lines.reduce((s, l) => s + l.actual_yield_kg, 0)),
    uncategorized_cost: round2(
      lines.filter(l => l.usage === UNCAT).reduce((s, l) => s + l.total_cost, 0)
    ),
  };

  const rotation = computeFieldRotation(db, field);

  return {
    field_id: fieldId,
    year,
    field,
    lines,
    totals,
    rotation,
    coverage: COVERAGE,
  };
}

// --- Rotation / replant recommendation (lifted from routes/farms.js:246-298 unchanged)
function computeFieldRotation(db, field) {
  if (field.enterprise !== 'rooibos' || !field.planted_year) return null;
  const plantedYear = parseInt(field.planted_year);
  const currentYear = new Date().getUTCFullYear();
  const rotationYear = currentYear - plantedYear;

  const latestStand = db.prepare(
    'SELECT stand_pct, year FROM field_production WHERE field_id = ? AND stand_pct IS NOT NULL ORDER BY year DESC LIMIT 1'
  ).get(field.id);
  const standTrend = db.prepare(
    'SELECT year, stand_pct FROM field_production WHERE field_id = ? AND stand_pct IS NOT NULL ORDER BY year DESC LIMIT 5'
  ).all(field.id).reverse();
  const currentStand = latestStand ? latestStand.stand_pct : null;

  let replant_status = 'ok';
  let replant_message = null;
  if (currentStand !== null) {
    if (currentStand < 50) {
      replant_status = 'must_replant';
      replant_message = `Stand at ${currentStand}% — below 50%, must replant`;
    } else if (rotationYear >= 5 && currentStand > 70) {
      replant_status = 'can_delay';
      replant_message = `Year ${rotationYear}, stand still ${currentStand}% — can delay replant 1 year`;
    } else if (rotationYear >= 5) {
      replant_status = 'must_replant';
      replant_message = `Year ${rotationYear}, stand at ${currentStand}% — schedule replant`;
    } else if (currentStand < 60) {
      replant_status = 'warning';
      replant_message = `Stand declining to ${currentStand}% at year ${rotationYear}`;
    }
  }

  let phase = 'production';
  if (rotationYear === 0) phase = 'establishment';
  else if (rotationYear === 1) phase = 'topping';
  else if (rotationYear >= 5 && replant_status === 'must_replant') phase = 'end_of_life';

  return {
    planted_year: plantedYear,
    rotation_year: rotationYear,
    phase,
    current_stand_pct: currentStand,
    stand_trend: standTrend,
    replant_status,
    replant_message,
  };
}

module.exports.computeFieldCop = computeFieldCop;
module.exports.computeFieldRotation = computeFieldRotation;
```

- [ ] **Step 4: Pass.** `npx vitest run tests/cop-service.test.js` — all green (roughly 17 tests across describes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/cop.js backend/tests/cop-service.test.js
git commit -m "feat(cloudskraal): computeFieldCop — per-usage cost/yield lines with coverage"
```

---

## Task 5: Route rewrite

**Files:**
- Modify: `backend/src/routes/farms.js`
- Test: `backend/tests/cost-of-production-api.test.js` (new)

- [ ] **Step 1: Create failing integration test**

Create `backend/tests/cost-of-production-api.test.js`:

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'capex.db');

const BASE = 'http://localhost:3001/api';
async function api(p, o = {}) {
  const res = await fetch(`${BASE}${p}`, {
    headers: { 'Content-Type': 'application/json' },
    ...o,
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

let rooibosFieldId;

beforeAll(async () => {
  const { data } = await api('/fields');
  const r = data.find(f => f.enterprise === 'rooibos');
  expect(r).toBeTruthy();
  rooibosFieldId = r.id;
});

afterAll(() => {
  // Clean up any test-created overhead rows (sentinel date 2099)
  const db = new Database(DB_PATH);
  db.prepare(`DELETE FROM inventory_transactions WHERE date LIKE '2099-%'`).run();
  db.close();
});

describe('cost-of-production API', () => {
  it('returns 200 with CopReport shape', async () => {
    const { status, data } = await api(`/fields/${rooibosFieldId}/cost-of-production?year=2026`);
    expect(status).toBe(200);
    expect(data).toHaveProperty('field_id', rooibosFieldId);
    expect(data).toHaveProperty('year', 2026);
    expect(Array.isArray(data.lines)).toBe(true);
    expect(data.totals).toHaveProperty('total_cost');
    expect(data.coverage.excludes).toContain('overhead');
  });

  it('missing year returns 400', async () => {
    const { status, data } = await api(`/fields/${rooibosFieldId}/cost-of-production`);
    expect(status).toBe(400);
    expect(data.error).toBe('year_required');
  });

  it('unknown field returns 404', async () => {
    const { status } = await api(`/fields/nonexistent/cost-of-production?year=2026`);
    expect(status).toBe(404);
  });

  it('overhead-tagged transactions are excluded from total_cost', async () => {
    // This test only works if we can inject an overhead transaction. Use direct DB write.
    const db = new Database(DB_PATH);
    const id = `test-overhead-${Date.now()}`;
    const now = new Date().toISOString();
    // find a product id
    const prod = db.prepare(`SELECT id FROM input_products LIMIT 1`).get();
    expect(prod).toBeTruthy();
    db.prepare(`INSERT INTO inventory_transactions
      (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        id, prod.id, 'usage', '2099-05-01', 1, 9999, 9999, rooibosFieldId, 'overhead', now
      );
    db.close();
    const { data } = await api(`/fields/${rooibosFieldId}/cost-of-production?year=2099`);
    expect(data.totals.total_cost).toBe(0);
  });
});
```

- [ ] **Step 2: Start server, run test, confirm failure**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
lsof -ti:3001 | xargs kill 2>/dev/null; sleep 1
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
SERVER_PID=$!
sleep 3
npx vitest run tests/cost-of-production-api.test.js
```

Expected: test 1 (shape) fails because current response is the old blob.

- [ ] **Step 3: Rewrite the route handler**

In `backend/src/routes/farms.js`:

Replace the entire `router.get('/fields/:id/cost-of-production', ...)` handler (starting around line 162, ending around line 303 before the next `router.get`) with:

```javascript
router.get('/fields/:id/cost-of-production', (req, res) => {
  const db = getDb();
  const yearStr = req.query.year;
  if (!yearStr || isNaN(Number(yearStr))) {
    return res.status(400).json({ error: 'year_required' });
  }
  const year = Number(yearStr);
  const { computeFieldCop } = require('../services/cop');
  const report = computeFieldCop(db, req.params.id, year);
  if (!report) return res.status(404).json({ error: 'Field not found' });
  res.json(report);
});
```

Delete the now-dead helper code (`field` fetch, production/inputs/taskInputs/labour/tasks SQL, summary computation, rotation block) that made up the old handler — everything between the new handler and the next `router.get`. The rotation logic now lives inside `services/cop.js`.

- [ ] **Step 4: Restart server and confirm tests pass**

```bash
kill $SERVER_PID 2>/dev/null; sleep 1
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
SERVER_PID=$!
sleep 3
npx vitest run tests/cost-of-production-api.test.js
```

Expected: 4 passed.

- [ ] **Step 5: Run the full test suite to catch regressions**

```bash
npx vitest run
```

Expected: all green (wiki-api, usage-service, usage-history-api, cop-service, cost-of-production-api).

- [ ] **Step 6: Kill server, commit**

```bash
kill $SERVER_PID 2>/dev/null; wait 2>/dev/null
git add backend/src/routes/farms.js backend/tests/cost-of-production-api.test.js
git commit -m "feat(cloudskraal): rewrite /cost-of-production route as CopReport wrapper"
```

---

## Task 6: Frontend types

**Files:**
- Modify: `frontend/src/types/farm.ts`

- [ ] **Step 1: Update the type**

In `frontend/src/types/farm.ts`, replace the `FieldCostOfProduction` interface with:

```typescript
export interface CopLine {
  usage: string;
  period_ids: string[];
  inputs: FieldInputTransaction[];
  task_inputs: FieldTaskInput[];
  labour: FieldLabourEntry[];
  production: FieldProduction[];
  total_input_cost: number;
  total_task_input_cost: number;
  total_labour_cost: number;
  total_labour_hours: number;
  total_cost: number;
  area_ha: number;
  cost_per_ha: number;
  estimated_yield_kg: number;
  actual_yield_kg: number;
  yield_per_ha: number;
  cost_per_kg: number | null;
  warnings: string[];
}

export interface CopCoverage {
  excludes: string[];
  denominator: string;
  notes: string;
}

export interface FieldCostOfProduction {
  field_id: string;
  year: number;
  field: Field;
  lines: CopLine[];
  totals: {
    total_cost: number;
    total_yield_kg: number;
    uncategorized_cost: number;
  };
  rotation: FieldRotation | null;
  coverage: CopCoverage;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npx tsc -b --noEmit
```

Expected: errors in `FieldPanel.tsx` (legitimately consuming old shape). Those are Task 7.

- [ ] **Step 3: Commit (type-only, field panel still broken)**

```bash
git add frontend/src/types/farm.ts
git commit -m "feat(cloudskraal): FieldCostOfProduction type — CopReport shape"
```

---

## Task 7: Frontend field panel render

**Files:**
- Modify: `frontend/src/components/map/FieldPanel.tsx`

This is the UI integration task. Read the existing panel carefully before changing it.

- [ ] **Step 1: Read the current panel**

```bash
cat /Users/alexnelja/projects/cloudskraal-capex/frontend/src/components/map/FieldPanel.tsx | head -300
```

Understand how `costData.summary`, `costData.inputs`, `costData.taskInputs`, `costData.labour`, `costData.production`, `costData.rotation` are used today. List every usage site.

- [ ] **Step 2: Update the panel to consume CopReport**

Replace references as follows:

| Old | New |
|---|---|
| `costData.summary.total_cost` | `costData.totals.total_cost` |
| `costData.summary.total_yield_kg` | `costData.totals.total_yield_kg` |
| `costData.inputs` | `costData.lines.flatMap(l => l.inputs)` (or render grouped — see below) |
| `costData.taskInputs` | `costData.lines.flatMap(l => l.task_inputs)` |
| `costData.labour` | `costData.lines.flatMap(l => l.labour)` |
| `costData.production` | `costData.lines.flatMap(l => l.production)` |
| `costData.tasks` | compute from lines' task_inputs, deduplicate by task id |
| `costData.summary.cost_per_ha` | primary: `costData.totals.total_cost / costData.field.area_ha`; per-usage: `line.cost_per_ha` |
| `costData.rotation` | `costData.rotation` (unchanged) |

Recommended UI change: render one collapsible section per line (usage), showing that usage's inputs/task_inputs/labour/production and per-line totals. Above the sections, a banner with `totals.total_cost`, `totals.total_yield_kg`. If `totals.uncategorized_cost > 0`, render a warning chip "Uncategorized: R{amount} — transactions with no active usage period."

Render the `coverage` block as a small footnote: "These figures exclude overhead, amortization, processing. Denominator: raw harvest kg."

- [ ] **Step 3: Typecheck**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: succeeds with the usual chunk-size warnings (pre-existing).

- [ ] **Step 5: Visual verification**

Start the backend on :3001 and frontend dev server. Open a rooibos field in the panel. Confirm:
- Banner totals match a manual sum.
- Per-usage sections render.
- Coverage footnote is visible.
- Rotation/replant block still shows for rooibos.

If you don't have a browser available, skip this step and flag it in the report for a human check.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/map/FieldPanel.tsx
git commit -m "feat(cloudskraal): FieldPanel — render CopReport lines, coverage, totals"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full backend test suite**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
lsof -ti:3001 | xargs kill 2>/dev/null; sleep 1
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
sleep 3
npx vitest run
lsof -ti:3001 | xargs kill 2>/dev/null; wait 2>/dev/null
```

Expected: all files green (wiki-api, usage-service, usage-history-api, cop-service, cost-of-production-api).

- [ ] **Step 2: Frontend typecheck + build**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npx tsc -b --noEmit && npm run build
```

Expected: no errors, build succeeds.

- [ ] **Step 3: Fresh DB boot + manual smoke**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
rm -f data/capex.db data/capex.db-shm data/capex.db-wal
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
sleep 4

FID=$(curl -sS http://localhost:3001/api/fields | node -e "
const fs=require('fs'); const d=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(d.find(f=>f.enterprise==='rooibos').id);
")
echo "rooibos field: $FID"

curl -sS "http://localhost:3001/api/fields/$FID/cost-of-production?year=2026" | python3 -m json.tool | head -80

lsof -ti:3001 | xargs kill 2>/dev/null; wait 2>/dev/null
```

Expected: CopReport JSON with `lines[]` containing rooibos entries, `coverage` block, `rotation` populated for rooibos.

- [ ] **Step 4: No further commit needed** — everything committed in prior tasks.

---

## Done criteria

- [ ] All backend tests pass (including 5 schema + ~12 cop-service + 4 cost-of-production-api).
- [ ] Frontend typechecks and builds.
- [ ] Fresh DB boot produces migration logs (or silence if already migrated).
- [ ] GET /cost-of-production returns `CopReport` with `lines`, `totals`, `rotation`, `coverage`.
- [ ] Field panel renders per-usage sections and coverage footnote.
- [ ] Legacy response shape no longer served anywhere.
