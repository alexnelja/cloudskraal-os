# Usage Intervals & Rotation-Aware Field State — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the backend foundation (schema, service, routes, seed) for interval-based field usage history so spec #2 (COP) can key on `(field_id, date-range, usage)`.

**Architecture:** New `field_usage_period` table is the canonical source of truth for what's on each field when. Existing `fields.enterprise/crop_type/planted_year` columns become a refresh-on-read-and-write cache of the currently-active period. Service layer owns validation (USAGE_TYPES enum, no-overlap invariant wrapped in a transaction), UTC date helpers, and cache refresh. Seed migrates from the existing 2026 land-use reconciliation plus a rooibos backfill from `planted_year`. `stand_pct` stays in `field_production` entirely for this spec.

**Tech Stack:** Node.js + Express, better-sqlite3 (WAL mode), vitest with a live server on `:3001` for integration tests. Tests-first per Alex's standing preference.

**Spec:** `docs/specs/2026-04-14-usage-intervals-rotation.md`

**Out of scope for this plan:**
- Frontend map overlay wire-up to `?as_of=`. The map already colors by the refreshed cache columns, so no break. A follow-up task can switch it to the new endpoint once the historical slider is designed.
- Spec #1b (field orientation + wind rows).

---

## File structure

**New files:**
- `backend/src/utils/dates.js` — `todayUTC()`, `CLOUDSKRAAL_TIMEZONE`
- `backend/src/db/schema-usage-periods.js` — `initUsagePeriodsSchema(db)`
- `backend/src/services/usage.js` — enums + validation + cache refresh
- `backend/src/db/seed-usage-periods.js` — 2026 + rooibos backfill
- `backend/src/routes/usage.js` — CRUD + map feed
- `backend/tests/usage-service.test.js` — pure unit tests
- `backend/tests/usage-history-api.test.js` — integration tests

**Modified files:**
- `backend/src/db/schema.js` — wire new schema module
- `backend/src/index.js` — mount new router, call new seed (ordering matters)
- `backend/src/routes/farms.js` — call `refreshFieldCurrent` on reads; reject cache-column writes in PATCH

---

## Workflow notes for the implementer

- **Tests-first, always.** Write the failing test. Run it. See it fail. Then minimal implementation. Run it. Pass. Commit.
- **Integration tests need a live server on :3001.** Start it with `PORT=3001 node src/index.js &` before `npm test`. Kill it after. A helper is fine but the pattern already exists in `wiki-api.test.js`.
- **Write commits that make sense in isolation.** One task = one or two commits.
- **better-sqlite3 is synchronous.** No async/await around DB calls. Wrap multi-statement operations in `db.transaction(fn)`.
- **Working directory for all commands:** `/Users/alexnelja/projects/cloudskraal-capex/backend` unless stated.

---

## Task 1: Date utility

**Files:**
- Create: `backend/src/utils/dates.js`
- Test: `backend/tests/usage-service.test.js` (date-utility portion only)

- [ ] **Step 1: Create the test file with a failing date-utility test**

Create `backend/tests/usage-service.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { todayUTC, CLOUDSKRAAL_TIMEZONE } from '../src/utils/dates.js';

describe('dates util', () => {
  it('todayUTC returns ISO YYYY-MM-DD', () => {
    const today = todayUTC();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today).toBe(new Date().toISOString().split('T')[0]);
  });

  it('CLOUDSKRAAL_TIMEZONE is Africa/Johannesburg', () => {
    expect(CLOUDSKRAAL_TIMEZONE).toBe('Africa/Johannesburg');
  });
});
```

- [ ] **Step 2: Confirm it fails**

Run: `npx vitest run tests/usage-service.test.js`
Expected: FAIL — module not found at `../src/utils/dates.js`.

- [ ] **Step 3: Implement**

Create `backend/src/utils/dates.js`:

```javascript
// All dates in field_usage_period are ISO YYYY-MM-DD in UTC.
// Cloudskraal is in Africa/Johannesburg (UTC+2) but date math is done in UTC
// throughout the backend to avoid off-by-one errors across midnight SA time.
// The timezone constant is exported for *display-only* use by the frontend.

const CLOUDSKRAAL_TIMEZONE = 'Africa/Johannesburg';

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

module.exports = { todayUTC, CLOUDSKRAAL_TIMEZONE };
```

**Note:** The test file uses ESM `import`, the source uses CommonJS `module.exports`. vitest handles this via its default transform. Match the style of the existing `wiki-api.test.js` — ESM in tests, CJS in src.

- [ ] **Step 4: Confirm it passes**

Run: `npx vitest run tests/usage-service.test.js`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/dates.js backend/tests/usage-service.test.js
git commit -m "feat(cloudskraal): add UTC date helpers for usage history"
```

---

## Task 2: Schema for `field_usage_period`

**Files:**
- Create: `backend/src/db/schema-usage-periods.js`
- Modify: `backend/src/db/schema.js` (wire it in)
- Test: `backend/tests/usage-service.test.js` (append schema probe)

- [ ] **Step 1: Append a schema test**

Append to `backend/tests/usage-service.test.js`:

```javascript
import Database from 'better-sqlite3';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';

describe('field_usage_period schema', () => {
  it('creates the table with expected columns', () => {
    const db = new Database(':memory:');
    initUsagePeriodsSchema(db);
    const cols = db.prepare("PRAGMA table_info(field_usage_period)").all();
    const names = cols.map(c => c.name).sort();
    expect(names).toEqual([
      'created_at', 'deleted_at', 'end_date', 'field_id', 'id',
      'notes', 'planted_date', 'rotation_year', 'source', 'start_date',
      'updated_at', 'usage',
    ]);
    db.close();
  });

  it('creates expected indexes', () => {
    const db = new Database(':memory:');
    initUsagePeriodsSchema(db);
    const idx = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='field_usage_period'"
    ).all().map(r => r.name);
    expect(idx).toContain('idx_fup_field_dates');
    expect(idx).toContain('idx_fup_active');
    db.close();
  });
});
```

- [ ] **Step 2: Confirm it fails**

Run: `npx vitest run tests/usage-service.test.js`
Expected: FAIL — `initUsagePeriodsSchema` not found.

- [ ] **Step 3: Implement the schema module**

Create `backend/src/db/schema-usage-periods.js`:

```javascript
function initUsagePeriodsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS field_usage_period (
      id            TEXT PRIMARY KEY,
      field_id      TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
      usage         TEXT NOT NULL,
      start_date    TEXT NOT NULL,
      end_date      TEXT,
      planted_date  TEXT,
      rotation_year INTEGER,
      source        TEXT NOT NULL,
      notes         TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      deleted_at    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fup_field_dates
      ON field_usage_period(field_id, start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_fup_active
      ON field_usage_period(field_id) WHERE end_date IS NULL AND deleted_at IS NULL;
  `);
}

module.exports = { initUsagePeriodsSchema };
```

- [ ] **Step 4: Wire into `schema.js`**

Modify `backend/src/db/schema.js`, line 7 block — add the import and call:

```javascript
const { initUsagePeriodsSchema } = require('./schema-usage-periods');
// ... after initFarmSchema(db):
initUsagePeriodsSchema(db);
```

Exact insertion: after `const { initPhase3Schema } = require('./schema-phase3');` add `const { initUsagePeriodsSchema } = require('./schema-usage-periods');`. In `getDb`, after `initPhase3Schema(db);` add `initUsagePeriodsSchema(db);`.

- [ ] **Step 5: Confirm tests pass**

Run: `npx vitest run tests/usage-service.test.js`
Expected: all passing (now 4 tests).

- [ ] **Step 6: Boot the backend to verify schema applies cleanly**

Run:
```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
PORT=3099 node src/index.js > /tmp/ck.log 2>&1 &
sleep 2
curl -sS http://localhost:3099/api/health
kill %1
```

Expected: `{"status":"ok",...}`. No errors in `/tmp/ck.log`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/db/schema-usage-periods.js backend/src/db/schema.js backend/tests/usage-service.test.js
git commit -m "feat(cloudskraal): field_usage_period schema + indexes"
```

---

## Task 3: Service layer — enums, validation, derivations

**Files:**
- Create: `backend/src/services/usage.js`
- Test: `backend/tests/usage-service.test.js` (append service tests)

- [ ] **Step 1: Append failing tests for enums, overlap, date math**

Append to `backend/tests/usage-service.test.js`:

```javascript
import {
  USAGE_TYPES, PERENNIAL_USAGES,
  isValidUsage, isPerennial,
  assertNoOverlap, yearsSincePlanted, rotationYearEffective,
} from '../src/services/usage.js';

describe('usage service — enums', () => {
  it('USAGE_TYPES contains expected values', () => {
    expect(USAGE_TYPES).toEqual(expect.arrayContaining([
      'rooibos', 'lupines_fourrages', 'oats', 'fallow',
      'almond', 'grazing', 'vines', 'wheat',
    ]));
  });

  it('rejects unknown usage', () => {
    expect(isValidUsage('rooibos')).toBe(true);
    expect(isValidUsage('unicorns')).toBe(false);
  });

  it('identifies perennials', () => {
    expect(isPerennial('rooibos')).toBe(true);
    expect(isPerennial('almond')).toBe(true);
    expect(isPerennial('vines')).toBe(true);
    expect(isPerennial('oats')).toBe(false);
  });
});

describe('usage service — assertNoOverlap', () => {
  const base = { field_id: 'f1', start_date: '2026-01-01', end_date: '2026-12-31', deleted_at: null };

  it('allows adjacent (end === next start)', () => {
    const existing = [{ ...base, id: 'a' }];
    expect(() =>
      assertNoOverlap(existing, { field_id: 'f1', start_date: '2026-12-31', end_date: '2027-06-30' })
    ).not.toThrow();
  });

  it('throws on 1-day overlap', () => {
    const existing = [{ ...base, id: 'a' }];
    expect(() =>
      assertNoOverlap(existing, { field_id: 'f1', start_date: '2026-12-30', end_date: '2027-06-30' })
    ).toThrow(/overlap/i);
  });

  it('ignores overlaps for other fields', () => {
    const existing = [{ ...base, id: 'a' }];
    expect(() =>
      assertNoOverlap(existing, { field_id: 'f2', start_date: '2026-06-01', end_date: '2026-09-01' })
    ).not.toThrow();
  });

  it('ignores soft-deleted rows', () => {
    const existing = [{ ...base, id: 'a', deleted_at: '2026-05-01T00:00:00Z' }];
    expect(() =>
      assertNoOverlap(existing, { field_id: 'f1', start_date: '2026-06-01', end_date: '2026-09-01' })
    ).not.toThrow();
  });

  it('handles open-ended existing period (end_date null)', () => {
    const open = { ...base, end_date: null, id: 'a' };
    expect(() =>
      assertNoOverlap([open], { field_id: 'f1', start_date: '2027-01-01', end_date: '2027-12-31' })
    ).toThrow(/overlap/i);
  });

  it('handles both new and existing open-ended', () => {
    const open = { ...base, end_date: null, id: 'a' };
    expect(() =>
      assertNoOverlap([open], { field_id: 'f1', start_date: '2025-01-01', end_date: null })
    ).toThrow(/overlap/i);
  });
});

describe('usage service — derivations', () => {
  it('yearsSincePlanted', () => {
    expect(yearsSincePlanted('2022-07-01', '2026-04-14')).toBe(3);
    expect(yearsSincePlanted('2022-07-01', '2022-07-01')).toBe(0);
    expect(yearsSincePlanted(null, '2026-04-14')).toBeNull();
  });

  it('rotationYearEffective prefers stored', () => {
    expect(rotationYearEffective({ usage: 'lupines_fourrages', rotation_year: 2, planted_date: '2025-05-01' }, '2026-06-01')).toBe(2);
  });

  it('rotationYearEffective derives for perennial when not stored', () => {
    expect(rotationYearEffective({ usage: 'rooibos', rotation_year: null, planted_date: '2022-07-01' }, '2026-04-14')).toBe(3);
  });

  it('rotationYearEffective is null for non-perennial without stored value', () => {
    expect(rotationYearEffective({ usage: 'oats', rotation_year: null, planted_date: null }, '2026-04-14')).toBeNull();
  });
});
```

- [ ] **Step 2: Confirm it fails**

Run: `npx vitest run tests/usage-service.test.js`
Expected: FAIL — `../src/services/usage.js` not found.

- [ ] **Step 3: Implement the service**

Create `backend/src/services/usage.js`:

```javascript
const USAGE_TYPES = [
  'rooibos',
  'lupines_fourrages',
  'oats',
  'fallow',
  'almond',
  'grazing',
  'vines',
  'wheat',
];

const PERENNIAL_USAGES = new Set(['rooibos', 'almond', 'vines']);

function isValidUsage(usage) {
  return USAGE_TYPES.includes(usage);
}

function isPerennial(usage) {
  return PERENNIAL_USAGES.has(usage);
}

// existingPeriods: rows for this (and possibly other) fields. Function filters
// to same field_id and excludes deleted. `candidate` is the proposed period.
// Throws if candidate overlaps any live existing period. Adjacency is allowed
// (a.end_date === b.start_date is OK). Open-ended (end_date === null) means
// "still active"; treated as +infinity.
function assertNoOverlap(existingPeriods, candidate) {
  const INF = '9999-12-31';
  const cStart = candidate.start_date;
  const cEnd = candidate.end_date ?? INF;

  for (const row of existingPeriods) {
    if (row.field_id !== candidate.field_id) continue;
    if (row.deleted_at) continue;
    if (row.id && candidate.id && row.id === candidate.id) continue; // self (update)
    const rStart = row.start_date;
    const rEnd = row.end_date ?? INF;
    // Overlap iff NOT (cEnd <= rStart || cStart >= rEnd) — adjacency at boundary is OK.
    if (!(cEnd <= rStart || cStart >= rEnd)) {
      const err = new Error(`overlap with period ${row.id}`);
      err.code = 'overlap';
      err.conflict = row.id;
      throw err;
    }
  }
}

function yearsSincePlanted(plantedDate, asOf) {
  if (!plantedDate) return null;
  const [py, pm, pd] = plantedDate.split('-').map(Number);
  const [ay, am, ad] = asOf.split('-').map(Number);
  let years = ay - py;
  if (am < pm || (am === pm && ad < pd)) years -= 1;
  return years;
}

function rotationYearEffective(period, asOf) {
  if (period.rotation_year != null) return period.rotation_year;
  if (isPerennial(period.usage) && period.planted_date) {
    return yearsSincePlanted(period.planted_date, asOf);
  }
  return null;
}

module.exports = {
  USAGE_TYPES,
  PERENNIAL_USAGES,
  isValidUsage,
  isPerennial,
  assertNoOverlap,
  yearsSincePlanted,
  rotationYearEffective,
};
```

- [ ] **Step 4: Confirm tests pass**

Run: `npx vitest run tests/usage-service.test.js`
Expected: all service tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/usage.js backend/tests/usage-service.test.js
git commit -m "feat(cloudskraal): usage service — enums, overlap check, rotation derivation"
```

---

## Task 4: `refreshFieldCurrent` cache helper

**Files:**
- Modify: `backend/src/services/usage.js` (add `refreshFieldCurrent`)
- Test: `backend/tests/usage-service.test.js` (append)

- [ ] **Step 1: Append failing test**

Append to `backend/tests/usage-service.test.js`:

```javascript
import { refreshFieldCurrent } from '../src/services/usage.js';
import { initFarmSchema } from '../src/db/schema-farms.js';

describe('refreshFieldCurrent', () => {
  function setup() {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initFarmSchema(db);
    initUsagePeriodsSchema(db);
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO farms (id, name, code, type, created_at, updated_at) VALUES (?,?,?,?,?,?)`)
      .run('farm1', 'Test', 'test', 'owned', now, now);
    db.prepare(`INSERT INTO fields (id, farm_id, name, enterprise, geometry, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?)`)
      .run('fld1', 'farm1', 'F1', 'unclassified', '{}', now, now);
    return db;
  }

  it('sets enterprise/crop_type/planted_year from active period', () => {
    const db = setup();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO field_usage_period (id, field_id, usage, start_date, end_date,
                planted_date, source, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?)`)
      .run('p1', 'fld1', 'rooibos', '2022-07-01', null, '2022-07-01', 'seed-rooibos-backfill', now, now);
    refreshFieldCurrent(db, 'fld1', '2026-04-14');
    const f = db.prepare('SELECT enterprise, crop_type, planted_year FROM fields WHERE id=?').get('fld1');
    expect(f.enterprise).toBe('rooibos');
    expect(f.crop_type).toBe('rooibos');
    expect(f.planted_year).toBe('2022');
  });

  it('picks most recent start_date when multiple active', () => {
    const db = setup();
    const now = new Date().toISOString();
    const ins = db.prepare(`INSERT INTO field_usage_period (id, field_id, usage, start_date, end_date,
                planted_date, source, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?)`);
    // Older closed period + newer active period (non-overlapping)
    ins.run('p1', 'fld1', 'rooibos', '2022-01-01', '2026-03-31', '2022-01-01', 'seed', now, now);
    ins.run('p2', 'fld1', 'lupines_fourrages', '2026-05-01', null, '2026-05-01', 'seed', now, now);
    refreshFieldCurrent(db, 'fld1', '2026-06-01');
    const f = db.prepare('SELECT enterprise FROM fields WHERE id=?').get('fld1');
    expect(f.enterprise).toBe('lupines_fourrages');
  });

  it('leaves cache untouched when no active period', () => {
    const db = setup();
    db.prepare(`UPDATE fields SET enterprise=? WHERE id=?`).run('rooibos', 'fld1');
    refreshFieldCurrent(db, 'fld1', '2026-04-14');
    const f = db.prepare('SELECT enterprise FROM fields WHERE id=?').get('fld1');
    expect(f.enterprise).toBe('rooibos'); // unchanged
  });

  it('excludes soft-deleted periods', () => {
    const db = setup();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO field_usage_period (id, field_id, usage, start_date, end_date,
                planted_date, source, deleted_at, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run('p1', 'fld1', 'rooibos', '2022-07-01', null, '2022-07-01', 'seed', now, now, now);
    db.prepare(`UPDATE fields SET enterprise='original' WHERE id=?`).run('fld1');
    refreshFieldCurrent(db, 'fld1', '2026-04-14');
    const f = db.prepare('SELECT enterprise FROM fields WHERE id=?').get('fld1');
    expect(f.enterprise).toBe('original');
  });
});
```

- [ ] **Step 2: Confirm it fails**

Run: `npx vitest run tests/usage-service.test.js`
Expected: FAIL — `refreshFieldCurrent` not exported.

- [ ] **Step 3: Implement**

Append to `backend/src/services/usage.js`:

```javascript
// Picks the period active at `asOf` for a field and syncs the scalar cache
// columns on `fields` to match. If multiple periods cover `asOf` (shouldn't
// happen due to assertNoOverlap, but defensive), picks the one with the most
// recent start_date. If none, leaves the cache alone — Spec #1 does not clear
// stale cache; that'd fight the old frontend. Filters out soft-deleted rows.
function refreshFieldCurrent(db, fieldId, asOf) {
  const row = db.prepare(`
    SELECT usage, planted_date
      FROM field_usage_period
     WHERE field_id = ?
       AND deleted_at IS NULL
       AND start_date <= ?
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY start_date DESC
     LIMIT 1
  `).get(fieldId, asOf, asOf);

  if (!row) return;

  const plantedYear = row.planted_date ? row.planted_date.slice(0, 4) : null;
  db.prepare(`UPDATE fields SET enterprise=?, crop_type=?, planted_year=?, updated_at=? WHERE id=?`)
    .run(row.usage, row.usage, plantedYear, new Date().toISOString(), fieldId);
}

module.exports.refreshFieldCurrent = refreshFieldCurrent;
```

- [ ] **Step 4: Confirm tests pass**

Run: `npx vitest run tests/usage-service.test.js`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/usage.js backend/tests/usage-service.test.js
git commit -m "feat(cloudskraal): refreshFieldCurrent syncs fields cache from active period"
```

---

## Task 5: Seed — 2026 + rooibos backfill

**Files:**
- Create: `backend/src/db/seed-usage-periods.js`
- Modify: `backend/src/index.js` (call the new seed AFTER `seedLandUse2026`)

- [ ] **Step 1: Read the 2026 seed to understand the data available**

Run: `head -200 backend/src/db/seed-land-use-2026.js` (just read it; no change).

Key facts you'll need:
- 2026 assignments are keyed by field `code` or `name`.
- `planted` values of `'2022'`, `'2023'`, `'2024'`, `'2025'`, `'2026'`, `'lupines'`, `'oats'`, `'fallow'`.
- `enterprise` values: `'rooibos'`, `'lupines'`, `'oats'`, `'fallow'`.

The seed has already **updated `fields.enterprise`/`crop_type`/`planted_year`/`area_ha`** for 2026. So by the time `seedUsagePeriods` runs, `fields` is already reconciled. Read from `fields` directly, not from the assignments constant.

- [ ] **Step 2: Implement the seed (no test — exercised by integration tests in Task 7)**

Create `backend/src/db/seed-usage-periods.js`:

```javascript
const { v4: uuidv4 } = require('uuid');
const { isValidUsage } = require('../services/usage');

// Map 2026 enterprise → canonical USAGE_TYPES value.
function canonicalUsage(enterprise, crop_type) {
  if (enterprise === 'rooibos') return 'rooibos';
  if (enterprise === 'lupines') return 'lupines_fourrages';
  if (enterprise === 'oats') return 'oats';
  if (enterprise === 'fallow') return 'fallow';
  if (enterprise === 'almond' || crop_type === 'almond') return 'almond';
  // Unknown — skip with a warning rather than insert garbage.
  return null;
}

function seedUsagePeriods(db) {
  try {
    const check = db.prepare('SELECT COUNT(*) as c FROM field_usage_period').get().c;
    if (check > 0) {
      console.log('Usage periods already seeded, skipping.');
      return;
    }
  } catch (e) {
    console.log('field_usage_period table not ready, skipping usage seed.');
    return;
  }

  console.log('Seeding field_usage_period (2026 + rooibos backfill)...');
  const now = new Date().toISOString();

  const fields = db.prepare(`
    SELECT id, enterprise, crop_type, planted_year, area_ha
      FROM fields
     WHERE enterprise IS NOT NULL AND enterprise != 'unclassified'
  `).all();

  const insert = db.prepare(`
    INSERT INTO field_usage_period
      (id, field_id, usage, start_date, end_date, planted_date, rotation_year,
       source, notes, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `);

  // Existing check — do not overwrite a manual entry at the same start_date.
  const existsAt = db.prepare(`
    SELECT id FROM field_usage_period
     WHERE field_id = ? AND start_date = ? AND deleted_at IS NULL
  `);

  const tx = db.transaction((rows) => {
    let inserted = 0;
    let skipped = 0;
    for (const f of rows) {
      const usage = canonicalUsage(f.enterprise, f.crop_type);
      if (!usage || !isValidUsage(usage)) {
        skipped++;
        continue;
      }

      // Determine the active period's start_date.
      // For rooibos with a known planted_year < 2026 → single open period from
      // planted_year-01-01. For rooibos planted 2026 or non-rooibos, start is
      // 2026-01-01 (beginning of the planning year).
      // Limitation (documented in spec): intra-year rip-and-replant cannot be
      // distinguished from continuous rooibos.
      let startDate;
      let plantedDate = null;
      let source;
      if (usage === 'rooibos' && f.planted_year && parseInt(f.planted_year) < 2026) {
        startDate = `${f.planted_year}-01-01`;
        plantedDate = startDate;
        source = 'seed-rooibos-backfill';
      } else {
        startDate = '2026-01-01';
        plantedDate = f.planted_year ? `${f.planted_year}-01-01` : null;
        source = 'seed-2026';
      }

      if (existsAt.get(f.id, startDate)) {
        skipped++;
        continue;
      }

      insert.run(
        uuidv4(), f.id, usage, startDate, null, plantedDate, null,
        source, null, now, now
      );
      inserted++;
    }
    console.log(`  Usage periods: inserted ${inserted}, skipped ${skipped}.`);
  });

  tx(fields);
}

module.exports = { seedUsagePeriods };
```

- [ ] **Step 3: Wire into `index.js`**

Modify `backend/src/index.js`:

After the line `const { seedLandUse2026 } = require('./db/seed-land-use-2026');` (line 13), add:
```javascript
const { seedUsagePeriods } = require('./db/seed-usage-periods');
```

After `seedLandUse2026(db);` (line 79), add:
```javascript
seedUsagePeriods(db);
```

Ordering matters: `seedLandUse2026` must run first — it populates `fields.enterprise/planted_year` which the new seed reads.

- [ ] **Step 4: Delete the dev DB and re-seed to verify end-to-end**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
rm -f data/capex.db data/capex.db-shm data/capex.db-wal
PORT=3099 node src/index.js > /tmp/ck.log 2>&1 &
sleep 4
grep "Usage periods:" /tmp/ck.log
curl -sS 'http://localhost:3099/api/health'
kill %1
```

Expected log line: `Usage periods: inserted N, skipped M.` with N matching roughly the number of non-unclassified fields.

Sanity check the DB:
```bash
sqlite3 data/capex.db "SELECT usage, COUNT(*), source FROM field_usage_period GROUP BY usage, source;"
```

Expected: rooibos rows from both `seed-2026` and `seed-rooibos-backfill`; others only `seed-2026`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/seed-usage-periods.js backend/src/index.js
git commit -m "feat(cloudskraal): seed field_usage_period from 2026 + rooibos backfill"
```

---

## Task 6: CRUD routes for periods

**Files:**
- Create: `backend/src/routes/usage.js`
- Modify: `backend/src/index.js` (mount router)
- Test: `backend/tests/usage-history-api.test.js`

- [ ] **Step 1: Create failing integration tests**

Create `backend/tests/usage-history-api.test.js`:

```javascript
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:3001/api';

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

let fieldId;

beforeAll(async () => {
  const { data } = await api('/fields');
  expect(Array.isArray(data)).toBe(true);
  expect(data.length).toBeGreaterThan(0);
  fieldId = data[0].id;
});

describe('usage-periods CRUD', () => {
  const createdIds = [];

  it('GET /fields/:id/usage-periods returns seeded rows', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('POST rejects unknown usage', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`, {
      method: 'POST',
      body: JSON.stringify({ usage: 'unicorns', start_date: '2030-01-01' }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('invalid_usage');
    expect(Array.isArray(data.valid)).toBe(true);
  });

  it('POST rejects end_date before start_date', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`, {
      method: 'POST',
      body: JSON.stringify({ usage: 'oats', start_date: '2030-06-01', end_date: '2030-05-01' }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('invalid_interval');
  });

  it('POST creates a period in the future (avoids seed collisions)', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`, {
      method: 'POST',
      body: JSON.stringify({ usage: 'oats', start_date: '2030-01-01', end_date: '2030-12-31' }),
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    expect(data.source).toBe('manual');
    createdIds.push(data.id);
  });

  it('POST overlapping period returns 409', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`, {
      method: 'POST',
      body: JSON.stringify({ usage: 'oats', start_date: '2030-06-01', end_date: '2031-05-31' }),
    });
    expect(status).toBe(409);
    expect(data.error).toBe('overlap');
    expect(data.conflict).toBe(createdIds[0]);
  });

  it('POST adjacent period is allowed', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`, {
      method: 'POST',
      body: JSON.stringify({ usage: 'lupines_fourrages', start_date: '2030-12-31', end_date: '2031-06-30' }),
    });
    expect(status).toBe(201);
    createdIds.push(data.id);
  });

  it('PUT updates an existing period', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods/${createdIds[0]}`, {
      method: 'PUT',
      body: JSON.stringify({ notes: 'updated' }),
    });
    expect(status).toBe(200);
    expect(data.notes).toBe('updated');
  });

  it('PUT on missing period returns 404', async () => {
    const { status } = await api(`/fields/${fieldId}/usage-periods/nonexistent`, {
      method: 'PUT',
      body: JSON.stringify({ notes: 'x' }),
    });
    expect(status).toBe(404);
  });

  it('DELETE soft-deletes', async () => {
    const target = createdIds[1];
    const del = await api(`/fields/${fieldId}/usage-periods/${target}`, { method: 'DELETE' });
    expect(del.status).toBe(204);
    const list = await api(`/fields/${fieldId}/usage-periods`);
    const ids = list.data.map(p => p.id);
    expect(ids).not.toContain(target);
    // Cleanup — hard-delete via direct SQL would be ideal but we don't expose that;
    // leaving soft-deleted row is fine for idempotent reruns.
  });

  it('PATCH /fields/:id rejects enterprise write', async () => {
    const { status, data } = await api(`/fields/${fieldId}`, {
      method: 'PATCH',
      body: JSON.stringify({ enterprise: 'lupines_fourrages' }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('read_only');
  });
});

describe('perennial warning', () => {
  it('POST rooibos with rotation_year returns warning', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`, {
      method: 'POST',
      body: JSON.stringify({
        usage: 'rooibos', start_date: '2040-01-01', end_date: '2040-12-31',
        planted_date: '2040-01-01', rotation_year: 1,
      }),
    });
    expect(status).toBe(201);
    expect(data.warning).toBe('rotation_year_on_perennial');
    // Clean up
    await api(`/fields/${fieldId}/usage-periods/${data.id}`, { method: 'DELETE' });
  });
});

describe('usage-history map feed', () => {
  it('GET /usage-history returns rows joined with geometry', async () => {
    const { status, data } = await api('/usage-history?as_of=2026-04-14');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    const row = data[0];
    expect(row).toHaveProperty('field_id');
    expect(row).toHaveProperty('usage');
    expect(row).toHaveProperty('geometry');
  });

  it('GET /usage-history?as_of=2020-01-01 returns fewer rows (pre-planting)', async () => {
    const recent = await api('/usage-history?as_of=2026-04-14');
    const old = await api('/usage-history?as_of=2020-01-01');
    expect(old.data.length).toBeLessThan(recent.data.length);
  });

  it('GET /usage-history defaults as_of to today', async () => {
    const { status } = await api('/usage-history');
    expect(status).toBe(200);
  });
});
```

- [ ] **Step 2: Start the server and run the tests to confirm failure**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
sleep 3
npx vitest run tests/usage-history-api.test.js
# leave server running; will kill at end of task
```

Expected: most tests fail (404s on new endpoints, 200 on the already-existing PATCH for enterprise — proving the PATCH-rejection test will fail until Task 7).

- [ ] **Step 3: Implement the routes**

Create `backend/src/routes/usage.js`:

```javascript
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const {
  USAGE_TYPES, isValidUsage, isPerennial,
  assertNoOverlap, rotationYearEffective, refreshFieldCurrent,
} = require('../services/usage');
const { todayUTC } = require('../utils/dates');

const router = express.Router();

function badUsage(res) {
  return res.status(400).json({ error: 'invalid_usage', valid: USAGE_TYPES });
}

function loadExisting(db, fieldId) {
  return db.prepare(`
    SELECT id, field_id, start_date, end_date, deleted_at
      FROM field_usage_period
     WHERE field_id = ? AND deleted_at IS NULL
  `).all(fieldId);
}

// GET list
router.get('/fields/:id/usage-periods', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, usage, start_date, end_date, planted_date, rotation_year,
           source, notes, created_at, updated_at
      FROM field_usage_period
     WHERE field_id = ? AND deleted_at IS NULL
     ORDER BY start_date DESC
  `).all(req.params.id);
  res.json(rows);
});

// POST create
router.post('/fields/:id/usage-periods', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (!isValidUsage(b.usage)) return badUsage(res);
  if (!b.start_date) return res.status(400).json({ error: 'start_date_required' });
  if (b.end_date && b.end_date < b.start_date) {
    return res.status(400).json({ error: 'invalid_interval' });
  }

  const candidate = {
    field_id: req.params.id,
    start_date: b.start_date,
    end_date: b.end_date ?? null,
  };

  const tx = db.transaction(() => {
    const existing = loadExisting(db, req.params.id);
    assertNoOverlap(existing, candidate);
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO field_usage_period
        (id, field_id, usage, start_date, end_date, planted_date, rotation_year,
         source, notes, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, req.params.id, b.usage, b.start_date, b.end_date ?? null,
      b.planted_date ?? null, b.rotation_year ?? null,
      b.source ?? 'manual', b.notes ?? null, now, now,
    );
    return id;
  });

  let id;
  try { id = tx(); } catch (e) {
    if (e.code === 'overlap') {
      return res.status(409).json({ error: 'overlap', conflict: e.conflict });
    }
    throw e;
  }

  refreshFieldCurrent(db, req.params.id, todayUTC());
  const row = db.prepare(`SELECT * FROM field_usage_period WHERE id=?`).get(id);
  if (b.rotation_year != null && isPerennial(b.usage)) {
    row.warning = 'rotation_year_on_perennial';
  }
  res.status(201).json(row);
});

// PUT update
router.put('/fields/:id/usage-periods/:periodId', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const row = db.prepare(`
    SELECT * FROM field_usage_period WHERE id=? AND field_id=? AND deleted_at IS NULL
  `).get(req.params.periodId, req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });

  if (b.usage && !isValidUsage(b.usage)) return badUsage(res);

  const next = {
    ...row,
    ...Object.fromEntries(
      ['usage', 'start_date', 'end_date', 'planted_date', 'rotation_year', 'notes']
        .filter(k => k in b)
        .map(k => [k, b[k]])
    ),
    id: row.id, field_id: row.field_id,
  };
  if (next.end_date && next.end_date < next.start_date) {
    return res.status(400).json({ error: 'invalid_interval' });
  }

  const tx = db.transaction(() => {
    const existing = loadExisting(db, req.params.id);
    assertNoOverlap(existing, next);
    db.prepare(`
      UPDATE field_usage_period
         SET usage=?, start_date=?, end_date=?, planted_date=?, rotation_year=?,
             notes=?, updated_at=?
       WHERE id=?
    `).run(
      next.usage, next.start_date, next.end_date, next.planted_date,
      next.rotation_year, next.notes, new Date().toISOString(), next.id,
    );
  });

  try { tx(); } catch (e) {
    if (e.code === 'overlap') {
      return res.status(409).json({ error: 'overlap', conflict: e.conflict });
    }
    throw e;
  }

  refreshFieldCurrent(db, req.params.id, todayUTC());
  const updated = db.prepare(`SELECT * FROM field_usage_period WHERE id=?`).get(next.id);
  res.json(updated);
});

// DELETE soft
router.delete('/fields/:id/usage-periods/:periodId', (req, res) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT id FROM field_usage_period WHERE id=? AND field_id=? AND deleted_at IS NULL
  `).get(req.params.periodId, req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  const now = new Date().toISOString();
  db.prepare(`UPDATE field_usage_period SET deleted_at=?, updated_at=? WHERE id=?`)
    .run(now, now, row.id);
  refreshFieldCurrent(db, req.params.id, todayUTC());
  res.status(204).end();
});

// Map overlay feed
router.get('/usage-history', (req, res) => {
  const db = getDb();
  const asOf = req.query.as_of || todayUTC();
  const rows = db.prepare(`
    SELECT p.id AS period_id, p.field_id, p.usage, p.rotation_year, p.planted_date,
           f.geometry
      FROM field_usage_period p
      JOIN fields f ON f.id = p.field_id
     WHERE p.deleted_at IS NULL
       AND p.start_date <= ?
       AND (p.end_date IS NULL OR p.end_date >= ?)
  `).all(asOf, asOf);

  const result = rows.map(r => ({
    field_id: r.field_id,
    period_id: r.period_id,
    usage: r.usage,
    rotation_year_effective: rotationYearEffective(
      { usage: r.usage, rotation_year: r.rotation_year, planted_date: r.planted_date },
      asOf,
    ),
    planted_date: r.planted_date,
    geometry: r.geometry,
  }));
  res.json(result);
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in `index.js`**

In `backend/src/index.js`, after `const supplyChainRoutes = require('./routes/supply-chain');`, add:
```javascript
const usageRoutes = require('./routes/usage');
```

After `app.use('/api', supplyChainRoutes);`, add:
```javascript
app.use('/api', usageRoutes);
```

- [ ] **Step 5: Restart the server and run tests**

```bash
kill %1 2>/dev/null; sleep 1
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
sleep 3
npx vitest run tests/usage-history-api.test.js
```

Expected: all pass except `PATCH /fields/:id rejects enterprise write` (that one is covered in Task 7).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/usage.js backend/src/index.js backend/tests/usage-history-api.test.js
git commit -m "feat(cloudskraal): field_usage_period CRUD + /api/usage-history feed"
```

Leave the server running for Task 7.

---

## Task 7: Lock PATCH + lazy refresh

**Files:**
- Modify: `backend/src/routes/farms.js`

- [ ] **Step 1: Confirm the PATCH test is still red**

```bash
npx vitest run tests/usage-history-api.test.js -t "PATCH /fields/:id rejects"
```

Expected: FAIL (currently returns 200).

- [ ] **Step 2: Modify the PATCH allow-list**

In `backend/src/routes/farms.js` line 106:

Before:
```javascript
const allowed = ['enterprise', 'crop_type', 'status', 'planted_year', 'soil_type', 'irrigation_type', 'notes'];
```

After:
```javascript
const readOnly = ['enterprise', 'crop_type', 'planted_year'];
const blocked = Object.keys(req.body || {}).filter(k => readOnly.includes(k));
if (blocked.length > 0) {
  return res.status(400).json({
    error: 'read_only',
    fields: blocked,
    managed_by: 'field_usage_period',
    use: 'POST /api/fields/:id/usage-periods',
  });
}
const allowed = ['status', 'soil_type', 'irrigation_type', 'notes'];
```

- [ ] **Step 3: Add lazy refresh to the two GETs**

At the top of `backend/src/routes/farms.js`, add:
```javascript
const { refreshFieldCurrent } = require('../services/usage');
const { todayUTC } = require('../utils/dates');
```

In the `GET /api/fields` handler (around line 42-80), **before** the final `res.json(rows)`, after the rows are loaded:
```javascript
const asOf = todayUTC();
rows.forEach(r => refreshFieldCurrent(db, r.id, asOf));
// Re-read to pick up any changes.
const refreshed = db.prepare(stmt).all(...params);  // or re-run the query
res.json(refreshed);
```

**Simpler approach** (fewer queries): call `refreshFieldCurrent` for the row and update in-memory:
```javascript
const asOf = todayUTC();
for (const r of rows) {
  refreshFieldCurrent(db, r.id, asOf);
}
// Rows held the old cached values; refresh the in-memory copy from fields.
const ids = rows.map(r => r.id);
if (ids.length > 0) {
  const placeholders = ids.map(() => '?').join(',');
  const fresh = db.prepare(
    `SELECT id, enterprise, crop_type, planted_year FROM fields WHERE id IN (${placeholders})`
  ).all(...ids);
  const byId = new Map(fresh.map(f => [f.id, f]));
  rows.forEach(r => {
    const f = byId.get(r.id);
    if (f) { r.enterprise = f.enterprise; r.crop_type = f.crop_type; r.planted_year = f.planted_year; }
  });
}
res.json(rows);
```

Apply the same pattern inside `GET /api/fields/:id` — call `refreshFieldCurrent(db, req.params.id, todayUTC())` before the SELECT.

- [ ] **Step 4: Run the whole test suite**

```bash
kill %1 2>/dev/null; sleep 1
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
sleep 3
npx vitest run
```

Expected: all 4 test files green (wiki-api, usage-service, usage-history-api, plus any others).

- [ ] **Step 5: Kill the server**

```bash
kill %1 2>/dev/null; wait 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/farms.js
git commit -m "feat(cloudskraal): lock PATCH read-only fields, lazy cache refresh on reads"
```

---

## Task 8: Final verification

- [ ] **Step 1: Fresh DB end-to-end boot**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
rm -f data/capex.db data/capex.db-shm data/capex.db-wal
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
sleep 4
```

Check `/tmp/ck.log` for the "Usage periods: inserted N" line. N should be the count of non-`unclassified` fields.

- [ ] **Step 2: Manual smoke test**

```bash
# Pick a rooibos field
FID=$(curl -sS http://localhost:3001/api/fields | node -e "
const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(d.find(f=>f.enterprise==='rooibos').id);
")
echo "field: $FID"

curl -sS "http://localhost:3001/api/fields/$FID/usage-periods" | python3 -m json.tool
curl -sS "http://localhost:3001/api/usage-history?as_of=2023-06-01" | python3 -c "
import json,sys; d=json.load(sys.stdin); print(f'{len(d)} active periods on 2023-06-01')
"
```

Expected: the rooibos field's periods include a backfilled row with `source='seed-rooibos-backfill'`. The 2023 query returns fewer rows than a 2026 query (only rooibos fields planted by then).

- [ ] **Step 3: Full test suite green**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Kill server, wrap up**

```bash
kill %1 2>/dev/null; wait 2>/dev/null
echo "done"
```

No final commit — everything committed in prior tasks. Ready for spec #2.

---

## Review & done criteria

- [ ] All tests green (`npx vitest run`)
- [ ] Fresh-DB boot produces expected seed log
- [ ] PATCH `/api/fields/:id` with `{enterprise}` returns 400
- [ ] GET `/api/usage-history?as_of=2023-06-01` returns rooibos-planted-by-then fields only
- [ ] Refresh-on-read: after `POST /usage-periods` then `GET /api/fields/:id`, `enterprise` reflects the new usage
- [ ] Soft-delete visible in SQL (`SELECT deleted_at FROM field_usage_period WHERE deleted_at IS NOT NULL`)
- [ ] Commits are one-logical-change each

Stop here. No frontend work. Spec #2 begins after this ships.
