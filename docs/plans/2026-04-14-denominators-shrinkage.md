# Denominators & Shrinkage Implementation Plan (Spec 2b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `conversion_factors` + per-context BFS factor chaining so `GET /api/fields/:id/cost-of-production?year=Y&denominator=X` can return cost-per-dried-kg or cost-per-netto-dry-kg with full factor-chain traceability.

**Architecture:** New `conversion_factors` table with effective dating and a unique constraint. Three service additions to `backend/src/services/cop.js` — `resolveDenominator`, `factorChain` (BFS with cycle detection), and a `denominator` option on `computeFieldCop`. Two new endpoints for CRUD on factors. Non-productive usages (fallow/grazing) short-circuit conversion; all-or-nothing semantics on missing edges for productive usages.

**Tech Stack:** Node.js + Express, better-sqlite3, vitest (live server on :3001). TDD.

**Spec:** `docs/specs/2026-04-14-denominators-shrinkage.md`

**Depends on:** Spec 2a fully landed — `services/cop.js` exists with `computeFieldCop`. This plan extends it.

**Out of scope** (other specs): per-batch shrinkage overrides (2e), wine/sheep tier maps (2g/2f), stokke/stof byproducts (2e), UI selector (2h).

---

## File structure

**New:**
- `backend/src/db/schema-conversion-factors.js` — `initConversionFactorsSchema(db)`
- `backend/src/db/seed-conversion-factors.js` — rooibos seed rows
- `backend/src/routes/conversion-factors.js` — GET/POST router
- `backend/tests/conversion-factors-api.test.js` — integration on :3001

**Modified:**
- `backend/src/db/schema.js` — wire the schema
- `backend/src/index.js` — mount router, call seed after other COP-related seeds
- `backend/src/services/cop.js` — add `resolveDenominator`, `factorChain`, extend `computeFieldCop(db, fieldId, year, opts)`
- `backend/tests/cop-service.test.js` — append unit tests
- `backend/tests/cost-of-production-api.test.js` — append integration tests

---

## Implementer notes

- **cwd:** `/Users/alexnelja/projects/cloudskraal-capex/backend`.
- Spec 2a MUST be merged first. Verify `backend/src/services/cop.js` exists and `computeFieldCop` returns a `CopReport` with a `coverage` block before starting.
- Tests ESM, src CJS. Pattern mirrors spec 2a exactly.
- Server on :3001 for integration tests; kill old listener first.
- All amounts rounded to 2 decimals at the end.
- No frontend work in this plan; 2h handles the UI.

---

## Task 1: Schema + seed

**Files:**
- Create: `backend/src/db/schema-conversion-factors.js`
- Create: `backend/src/db/seed-conversion-factors.js`
- Modify: `backend/src/db/schema.js`, `backend/src/index.js`
- Test: `backend/tests/cop-service.test.js` (append schema probe)

- [ ] **Step 1: Append failing schema test**

Append to `backend/tests/cop-service.test.js`:

```javascript
import { initConversionFactorsSchema } from '../src/db/schema-conversion-factors.js';
import { seedConversionFactors } from '../src/db/seed-conversion-factors.js';

describe('conversion_factors schema', () => {
  it('creates the table with expected columns', () => {
    const db = new Database(':memory:');
    initConversionFactorsSchema(db);
    const cols = db.prepare('PRAGMA table_info(conversion_factors)').all()
      .map(c => c.name).sort();
    expect(cols).toEqual([
      'context','created_at','effective_from','factor','from_uom',
      'id','notes','to_uom','updated_at'
    ]);
    db.close();
  });

  it('has a unique index on (from_uom, to_uom, context, effective_from)', () => {
    const db = new Database(':memory:');
    initConversionFactorsSchema(db);
    const idx = db.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='conversion_factors'"
    ).all();
    expect(idx.some(r => r.name === 'idx_factors_unique' && /UNIQUE/.test(r.sql))).toBe(true);
    db.close();
  });

  it('seeds the rooibos factors', () => {
    const db = new Database(':memory:');
    initConversionFactorsSchema(db);
    seedConversionFactors(db);
    const rows = db.prepare(
      "SELECT from_uom, to_uom, factor FROM conversion_factors WHERE context='rooibos' ORDER BY from_uom"
    ).all();
    expect(rows).toEqual([
      { from_uom: 'dried_kg', to_uom: 'sifted_netto_dry_kg', factor: 0.87 },
      { from_uom: 'harvest_wet_kg', to_uom: 'dried_kg', factor: 0.45 },
    ]);
    db.close();
  });

  it('seed is idempotent', () => {
    const db = new Database(':memory:');
    initConversionFactorsSchema(db);
    seedConversionFactors(db);
    seedConversionFactors(db);
    const n = db.prepare("SELECT COUNT(*) as c FROM conversion_factors").get().c;
    expect(n).toBe(2);
    db.close();
  });
});
```

- [ ] **Step 2: Confirm fail.** `npx vitest run tests/cop-service.test.js`.

- [ ] **Step 3: Implement schema**

Create `backend/src/db/schema-conversion-factors.js`:

```javascript
function initConversionFactorsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversion_factors (
      id             TEXT PRIMARY KEY,
      from_uom       TEXT NOT NULL,
      to_uom         TEXT NOT NULL,
      context        TEXT NOT NULL,
      factor         REAL NOT NULL,
      effective_from TEXT NOT NULL,
      notes          TEXT,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_factors_lookup
      ON conversion_factors(from_uom, to_uom, context, effective_from);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_factors_unique
      ON conversion_factors(from_uom, to_uom, context, effective_from);
  `);
}

module.exports = { initConversionFactorsSchema };
```

- [ ] **Step 4: Implement seed**

Create `backend/src/db/seed-conversion-factors.js`:

```javascript
const { v4: uuidv4 } = require('uuid');

function seedConversionFactors(db) {
  try {
    const count = db.prepare(
      "SELECT COUNT(*) as c FROM conversion_factors WHERE context=? AND effective_from=?"
    ).get('rooibos', '2022-01-01').c;
    if (count > 0) {
      console.log('Conversion factors already seeded, skipping.');
      return;
    }
  } catch (e) {
    console.log('conversion_factors table not ready, skipping.');
    return;
  }

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO conversion_factors
      (id, from_uom, to_uom, context, factor, effective_from, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const rows = [
    ['harvest_wet_kg', 'dried_kg', 'rooibos', 0.45, '2022-01-01',
      'Typical drying shrink at Cloudskraal'],
    ['dried_kg', 'sifted_netto_dry_kg', 'rooibos', 0.87, '2022-01-01',
      '87% netto + 9% stokke + 4% stof'],
  ];

  const tx = db.transaction(() => {
    for (const [from, to, ctx, factor, eff, notes] of rows) {
      insert.run(uuidv4(), from, to, ctx, factor, eff, notes, now, now);
    }
  });
  tx();
  console.log(`  Seeded ${rows.length} rooibos conversion factors.`);
}

module.exports = { seedConversionFactors };
```

- [ ] **Step 5: Wire into `schema.js` and `index.js`**

In `backend/src/db/schema.js`:
- Add require: `const { initConversionFactorsSchema } = require('./schema-conversion-factors');`
- In `getDb()` after the other init calls, add: `initConversionFactorsSchema(db);`

In `backend/src/index.js`:
- Add require: `const { seedConversionFactors } = require('./db/seed-conversion-factors');`
- After the other seed calls, add: `seedConversionFactors(db);`

- [ ] **Step 6: Confirm tests pass**

Run: `npx vitest run tests/cop-service.test.js`
Expected: 4 new tests pass.

- [ ] **Step 7: Fresh DB boot sanity**

```bash
rm -f data/capex.db data/capex.db-shm data/capex.db-wal
PORT=3099 node src/index.js > /tmp/ck.log 2>&1 &
sleep 3
grep "Seeded" /tmp/ck.log
kill %1 2>/dev/null; wait 2>/dev/null
sqlite3 data/capex.db "SELECT context, from_uom, to_uom, factor FROM conversion_factors;"
```

Expected: 2 rooibos factor rows.

- [ ] **Step 8: Commit**

```bash
git add backend/src/db/schema-conversion-factors.js backend/src/db/seed-conversion-factors.js \
        backend/src/db/schema.js backend/src/index.js backend/tests/cop-service.test.js
git commit -m "feat(cloudskraal): conversion_factors schema + rooibos seed"
```

---

## Task 2: `resolveDenominator`

**Files:**
- Modify: `backend/src/services/cop.js`
- Test: append to `backend/tests/cop-service.test.js`

- [ ] **Step 1: Append failing test**

```javascript
import { resolveDenominator } from '../src/services/cop.js';

describe('resolveDenominator', () => {
  it('returns null when denominator is falsy', () => {
    expect(resolveDenominator('rooibos', undefined)).toBeNull();
    expect(resolveDenominator('rooibos', '')).toBeNull();
  });

  it('resolves rooibos tiers', () => {
    expect(resolveDenominator('rooibos', 'harvest')).toBe('harvest_wet_kg');
    expect(resolveDenominator('rooibos', 'dried')).toBe('dried_kg');
    expect(resolveDenominator('rooibos', 'netto_dry')).toBe('sifted_netto_dry_kg');
  });

  it('passes through unknown value as explicit UOM', () => {
    expect(resolveDenominator('rooibos', 'sifted_netto_dry_kg')).toBe('sifted_netto_dry_kg');
    expect(resolveDenominator('rooibos', 'nonsense')).toBe('nonsense');
  });

  it('passes through for unknown usage (factor chain will decide)', () => {
    expect(resolveDenominator('lupines_fourrages', 'netto_dry')).toBe('netto_dry');
  });
});
```

- [ ] **Step 2: Confirm fail.**

- [ ] **Step 3: Implement**

Append to `backend/src/services/cop.js` (before `module.exports`):

```javascript
// TIER_MAPS is hardcoded here for now. Specs 2f (sheep) and 2g (wine) extend it.
// If a fourth crop type lands (almonds, olives, buchu) reconsider moving this
// to a DB table so new tiers don't require a code change + deploy.
const TIER_MAPS = {
  rooibos: {
    harvest: 'harvest_wet_kg',
    dried: 'dried_kg',
    netto_dry: 'sifted_netto_dry_kg',
  },
};

function resolveDenominator(usage, denominator) {
  if (!denominator) return null;
  const tierMap = TIER_MAPS[usage] ?? {};
  if (tierMap[denominator]) return tierMap[denominator];
  return denominator;  // pass-through; factorChain will produce factor_missing if unknown
}
```

Add to exports:
```javascript
module.exports.resolveDenominator = resolveDenominator;
module.exports.TIER_MAPS = TIER_MAPS;
```

- [ ] **Step 4: Pass + commit**

```bash
npx vitest run tests/cop-service.test.js
git add backend/src/services/cop.js backend/tests/cop-service.test.js
git commit -m "feat(cloudskraal): resolveDenominator — tier → UOM per usage"
```

---

## Task 3: `factorChain` (BFS)

**Files:**
- Modify: `backend/src/services/cop.js`
- Test: append to `backend/tests/cop-service.test.js`

- [ ] **Step 1: Append failing tests**

```javascript
import { factorChain } from '../src/services/cop.js';

function seedFactors(db) {
  const now = new Date().toISOString();
  const ins = db.prepare(`INSERT INTO conversion_factors
    (id, from_uom, to_uom, context, factor, effective_from, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  ins.run('f1','harvest_wet_kg','dried_kg','rooibos',0.45,'2022-01-01',null,now,now);
  ins.run('f2','dried_kg','sifted_netto_dry_kg','rooibos',0.87,'2022-01-01',null,now,now);
}

describe('factorChain', () => {
  function setup() {
    const db = new Database(':memory:');
    initConversionFactorsSchema(db);
    seedFactors(db);
    return db;
  }

  it('returns 1.0 when from === to', () => {
    const db = setup();
    expect(factorChain(db, 'harvest_wet_kg', 'harvest_wet_kg', 'rooibos', '2026-12-31'))
      .toEqual({ factor: 1, path: [] });
    db.close();
  });

  it('single-hop', () => {
    const db = setup();
    const r = factorChain(db, 'harvest_wet_kg', 'dried_kg', 'rooibos', '2026-12-31');
    expect(r.factor).toBeCloseTo(0.45, 10);
    expect(r.path).toHaveLength(1);
    expect(r.path[0]).toEqual({ from_uom: 'harvest_wet_kg', to_uom: 'dried_kg', factor: 0.45, context: 'rooibos' });
    db.close();
  });

  it('multi-hop product', () => {
    const db = setup();
    const r = factorChain(db, 'harvest_wet_kg', 'sifted_netto_dry_kg', 'rooibos', '2026-12-31');
    expect(r.factor).toBeCloseTo(0.45 * 0.87, 10);
    expect(r.path).toHaveLength(2);
    db.close();
  });

  it('missing edge returns error', () => {
    const db = setup();
    const r = factorChain(db, 'harvest_wet_kg', 'nonsense_uom', 'rooibos', '2026-12-31');
    expect(r.error).toBe('factor_missing');
    expect(r.missing_edge).toBeTruthy();
    db.close();
  });

  it('asOf before effective_from returns error', () => {
    const db = setup();
    const r = factorChain(db, 'harvest_wet_kg', 'dried_kg', 'rooibos', '2020-01-01');
    expect(r.error).toBe('factor_missing');
    db.close();
  });

  it('picks most recent effective_from row for a given edge', () => {
    const db = setup();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO conversion_factors
      (id, from_uom, to_uom, context, factor, effective_from, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('f3','harvest_wet_kg','dried_kg','rooibos',0.46,'2026-07-01',null,now,now);
    const r2025 = factorChain(db, 'harvest_wet_kg', 'dried_kg', 'rooibos', '2025-12-31');
    const r2026 = factorChain(db, 'harvest_wet_kg', 'dried_kg', 'rooibos', '2026-12-31');
    expect(r2025.factor).toBeCloseTo(0.45, 10);
    expect(r2026.factor).toBeCloseTo(0.46, 10);
    db.close();
  });
});
```

- [ ] **Step 2: Confirm fail.**

- [ ] **Step 3: Implement**

Append to `backend/src/services/cop.js`:

```javascript
function factorChain(db, fromUom, toUom, context, asOf) {
  if (fromUom === toUom) return { factor: 1, path: [] };

  // Pick the most-recent effective edge for every (from, to) in this context.
  const edges = db.prepare(`
    SELECT from_uom, to_uom, factor, context, MAX(effective_from) AS ef
      FROM conversion_factors
     WHERE context = ? AND effective_from <= ?
     GROUP BY from_uom, to_uom, context
  `).all(context, asOf);

  // Build adjacency: from_uom → [{to, factor, ...}]
  const adj = new Map();
  for (const e of edges) {
    if (!adj.has(e.from_uom)) adj.set(e.from_uom, []);
    adj.get(e.from_uom).push(e);
  }

  // BFS
  const visited = new Set([fromUom]);
  const parents = new Map();  // node → edge that led here
  const queue = [fromUom];
  let found = false;
  while (queue.length) {
    const node = queue.shift();
    if (node === toUom) { found = true; break; }
    for (const edge of adj.get(node) ?? []) {
      if (!visited.has(edge.to_uom)) {
        visited.add(edge.to_uom);
        parents.set(edge.to_uom, edge);
        queue.push(edge.to_uom);
      }
    }
  }

  if (!found) {
    // Report the first missing edge leaving the source.
    const missing = adj.has(fromUom)
      ? `${adj.get(fromUom)[0].to_uom} → ${toUom}`  // adjacent edge exists but chain incomplete
      : `${fromUom} → ?`;
    return { error: 'factor_missing', missing_edge: `${fromUom} → ${toUom}`, context };
  }

  // Walk back to build the path
  const path = [];
  let node = toUom;
  while (node !== fromUom) {
    const edge = parents.get(node);
    path.unshift({ from_uom: edge.from_uom, to_uom: edge.to_uom, factor: edge.factor, context: edge.context });
    node = edge.from_uom;
  }

  const factor = path.reduce((acc, e) => acc * e.factor, 1);
  return { factor, path };
}

module.exports.factorChain = factorChain;
```

- [ ] **Step 4: Pass + commit**

```bash
npx vitest run tests/cop-service.test.js
git add backend/src/services/cop.js backend/tests/cop-service.test.js
git commit -m "feat(cloudskraal): factorChain — BFS over conversion_factors with effective dating"
```

---

## Task 4: Extend `computeFieldCop` with denominator

**Files:**
- Modify: `backend/src/services/cop.js`
- Test: append to `backend/tests/cop-service.test.js`

- [ ] **Step 1: Append failing tests**

```javascript
describe('computeFieldCop with denominator', () => {
  function setup() {
    const db = setupDb();                              // migrateFieldCop etc.
    initUsagePeriodsSchema(db);
    initConversionFactorsSchema(db);
    seedFactors(db);
    seedField(db);
    db.prepare(`UPDATE fields SET area_ha=10, enterprise='rooibos' WHERE id='fld1'`).run();
    return db;
  }

  it('applies harvest→dried factor and reports factors_used', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null, planted_date:'2022-01-01' });
    seedInput(db, { id:'i1', product_id:'prod1', field_id:'fld1',
      date:'2026-05-01', total_cost:100 });
    seedProduction(db, { id:'y1', field_id:'fld1', year:2026,
      actual:1000, harvest_date:'2026-02-15' });

    const r = computeFieldCop(db, 'fld1', 2026, { denominator: 'dried' });
    expect(r.coverage.denominator).toBe('dried_kg');
    const line = r.lines.find(l => l.usage === 'rooibos');
    expect(line.yield_in_denominator_kg).toBeCloseTo(450, 1);  // 1000 * 0.45
    expect(line.cost_per_kg).toBeCloseTo(100 / 450, 3);
    expect(r.coverage.factors_used).toContainEqual(
      { from_uom: 'harvest_wet_kg', to_uom: 'dried_kg', factor: 0.45, context: 'rooibos' }
    );
    db.close();
  });

  it('applies full chain to netto_dry', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null });
    seedProduction(db, { id:'y1', field_id:'fld1', year:2026, actual:1000, harvest_date:'2026-02-15' });

    const r = computeFieldCop(db, 'fld1', 2026, { denominator: 'netto_dry' });
    expect(r.coverage.denominator).toBe('sifted_netto_dry_kg');
    const line = r.lines[0];
    expect(line.yield_in_denominator_kg).toBeCloseTo(1000 * 0.45 * 0.87, 1);
    expect(r.coverage.factors_used).toHaveLength(2);
    db.close();
  });

  it('non-productive usage (fallow) is not blocked by missing factor', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'fallow',
      start_date:'2022-01-01', end_date:null });
    // no conversion factors for fallow context — must not 400
    const r = computeFieldCop(db, 'fld1', 2026, { denominator: 'netto_dry' });
    expect(r.lines[0].usage).toBe('fallow');
    expect(r.lines[0].cost_per_kg).toBeNull();
    db.close();
  });

  it('missing edge on productive line returns error shape', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'lupines_fourrages',
      start_date:'2022-01-01', end_date:null });
    seedInput(db, { id:'i1', product_id:'prod1', field_id:'fld1',
      date:'2026-05-01', total_cost:50 });
    // no lupines factors seeded — chain unreachable
    const r = computeFieldCop(db, 'fld1', 2026, { denominator: 'netto_dry' });
    expect(r.error).toBe('factor_missing');
    expect(r.context).toBe('lupines_fourrages');
    db.close();
  });

  it('no denominator opt → spec 2a behaviour unchanged', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null });
    seedProduction(db, { id:'y1', field_id:'fld1', year:2026, actual:1000, harvest_date:'2026-02-15' });
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.coverage.denominator).toBe('raw_harvest_kg');
    expect(r.coverage.factors_used).toBeUndefined();
    db.close();
  });

  it('factors_used deduplicates across lines', () => {
    const db = setup();
    // Two adjacent rooibos periods in the same year — same factor edge consumed twice
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:'2026-06-30' });
    seedPeriod(db, { id:'p2', field_id:'fld1', usage:'rooibos',
      start_date:'2026-07-01', end_date:null });
    seedProduction(db, { id:'y1', field_id:'fld1', year:2026, actual:500, harvest_date:'2026-02-15' });
    seedProduction(db, { id:'y2', field_id:'fld1', year:2026, actual:500, harvest_date:'2026-09-15' });
    const r = computeFieldCop(db, 'fld1', 2026, { denominator: 'dried' });
    // Two periods = two lines? No — both usage='rooibos' collapse to one line.
    // factors_used should still have one entry.
    expect(r.coverage.factors_used).toHaveLength(1);
    db.close();
  });
});
```

- [ ] **Step 2: Confirm fail.**

- [ ] **Step 3: Modify `computeFieldCop`**

In `backend/src/services/cop.js`, update the function signature and add denominator handling. Look for the block that finalizes lines (before `const totals = {...}`).

Change signature:
```javascript
function computeFieldCop(db, fieldId, year, opts = {}) {
  // ... existing code unchanged through the line-population loops ...
```

**At the top of the finalize loop**, add denominator resolution per line:

```javascript
const NON_PRODUCTIVE = new Set(['fallow', 'grazing', 'fallow_greening']);
const denominatorOpt = opts.denominator;
const asOf = `${year}-12-31`;
const factorsUsed = [];

// (inside the final `for (const line of linesByUsage.values()) {...}` loop,
//  BEFORE the existing `line.total_cost = round2(...)` line, add:)
let denomFactor = 1;
let denomTarget = null;
if (denominatorOpt && !NON_PRODUCTIVE.has(line.usage)) {
  denomTarget = resolveDenominator(line.usage, denominatorOpt);
  if (denomTarget && denomTarget !== 'harvest_wet_kg') {
    const chain = factorChain(db, 'harvest_wet_kg', denomTarget, line.usage, asOf);
    if (chain.error) {
      // Surface the first-seen failure up as the response error.
      return { error: chain.error, missing_edge: chain.missing_edge, context: line.usage };
    }
    denomFactor = chain.factor;
    for (const edge of chain.path) factorsUsed.push(edge);
  }
}

// After line.total_cost and friends are computed, add converted yield:
line.yield_in_denominator_kg = round2(line.actual_yield_kg * denomFactor);

// Override cost_per_kg and yield_per_ha against converted denominator if factor applied
if (denomFactor !== 1) {
  line.cost_per_kg = line.yield_in_denominator_kg > 0
    ? round2(line.total_cost / line.yield_in_denominator_kg) : null;
  line.yield_per_ha = round2(line.yield_in_denominator_kg / area_ha);
}
```

**At the end of the function**, before `return`, extend coverage:

```javascript
const coverage = { ...COVERAGE };
if (denominatorOpt) {
  // Dedup factors_used by (from, to, context, factor)
  const seen = new Set();
  coverage.factors_used = [];
  for (const e of factorsUsed) {
    const key = `${e.from_uom}|${e.to_uom}|${e.context}|${e.factor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    coverage.factors_used.push(e);
  }
  // Denominator — if all productive lines resolved to the same target, show it;
  // otherwise fall back to 'mixed' (shouldn't happen given all-or-nothing, but defensive).
  const targets = new Set(
    lines.filter(l => !NON_PRODUCTIVE.has(l.usage))
         .map(l => resolveDenominator(l.usage, denominatorOpt) || 'harvest_wet_kg')
  );
  coverage.denominator = targets.size === 1 ? [...targets][0] : 'mixed';
} else {
  coverage.denominator = 'raw_harvest_kg';
}

return { field_id: fieldId, year, field, lines, totals, rotation, coverage };
```

**Remove the old `COVERAGE` const from the return** (we now build `coverage` inline). Keep `COVERAGE` as the shared constant with the `excludes`/`notes` fields; just spread it.

- [ ] **Step 4: Pass tests**

```bash
npx vitest run tests/cop-service.test.js
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/cop.js backend/tests/cop-service.test.js
git commit -m "feat(cloudskraal): computeFieldCop — denominator option with factor chain"
```

---

## Task 5: Conversion-factors routes

**Files:**
- Create: `backend/src/routes/conversion-factors.js`
- Modify: `backend/src/index.js` (mount)
- Test: `backend/tests/conversion-factors-api.test.js` (new)

- [ ] **Step 1: Create failing integration tests**

Create `backend/tests/conversion-factors-api.test.js`:

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
    headers: { 'Content-Type': 'application/json' }, ...o,
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

afterAll(() => {
  // Clean up any test-created rows (sentinel context 'test_ctx')
  const db = new Database(DB_PATH);
  db.prepare(`DELETE FROM conversion_factors WHERE context='test_ctx'`).run();
  db.close();
});

describe('conversion-factors API', () => {
  it('GET with context filter returns seeded rooibos rows', async () => {
    const { status, data } = await api('/conversion-factors?context=rooibos');
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(2);
    const rows = data.map(r => `${r.from_uom}->${r.to_uom}`);
    expect(rows).toContain('harvest_wet_kg->dried_kg');
    expect(rows).toContain('dried_kg->sifted_netto_dry_kg');
  });

  it('GET with as_of before 2022 returns empty', async () => {
    const { data } = await api('/conversion-factors?context=rooibos&as_of=2020-01-01');
    expect(data).toEqual([]);
  });

  it('POST creates a factor row', async () => {
    const { status, data } = await api('/conversion-factors', {
      method: 'POST',
      body: JSON.stringify({
        from_uom: 'test_wet', to_uom: 'test_dry', context: 'test_ctx',
        factor: 0.5, effective_from: '2030-01-01', notes: 'unit test'
      }),
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
  });

  it('POST duplicate (same from/to/context/effective_from) → 409', async () => {
    await api('/conversion-factors', {
      method: 'POST',
      body: JSON.stringify({
        from_uom: 'test_a', to_uom: 'test_b', context: 'test_ctx',
        factor: 0.9, effective_from: '2030-01-01',
      }),
    });
    const { status, data } = await api('/conversion-factors', {
      method: 'POST',
      body: JSON.stringify({
        from_uom: 'test_a', to_uom: 'test_b', context: 'test_ctx',
        factor: 0.85, effective_from: '2030-01-01',
      }),
    });
    expect(status).toBe(409);
    expect(data.error).toBe('duplicate_factor');
  });

  it('POST factor=0 → 400 invalid_factor', async () => {
    const { status, data } = await api('/conversion-factors', {
      method: 'POST',
      body: JSON.stringify({
        from_uom: 'test_z', to_uom: 'test_y', context: 'test_ctx',
        factor: 0, effective_from: '2030-01-01',
      }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('invalid_factor');
  });

  it('POST missing field → 400 missing_field', async () => {
    const { status, data } = await api('/conversion-factors', {
      method: 'POST',
      body: JSON.stringify({ from_uom: 'test_m', context: 'test_ctx', factor: 1,
        effective_from: '2030-01-01' }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('missing_field');
  });

  it('POST bad effective_from → 400 invalid_date', async () => {
    const { status, data } = await api('/conversion-factors', {
      method: 'POST',
      body: JSON.stringify({
        from_uom: 'test_p', to_uom: 'test_q', context: 'test_ctx',
        factor: 1, effective_from: 'not-a-date',
      }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('invalid_date');
  });
});
```

- [ ] **Step 2: Start server, confirm fail**

```bash
lsof -ti:3001 | xargs kill 2>/dev/null; sleep 1
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
SERVER_PID=$!
sleep 3
npx vitest run tests/conversion-factors-api.test.js
```

Expected: all 404 or similar failure.

- [ ] **Step 3: Implement router**

Create `backend/src/routes/conversion-factors.js`:

```javascript
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { todayUTC } = require('../utils/dates');

const router = express.Router();

function isValidIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
    && !isNaN(new Date(s).getTime());
}

router.get('/conversion-factors', (req, res) => {
  const db = getDb();
  const context = req.query.context;
  const asOf = req.query.as_of || todayUTC();
  if (!context) return res.status(400).json({ error: 'context_required' });
  const rows = db.prepare(`
    SELECT id, from_uom, to_uom, context, factor, effective_from, notes, created_at, updated_at
      FROM conversion_factors
     WHERE context = ? AND effective_from <= ?
     ORDER BY from_uom, to_uom, effective_from DESC
  `).all(context, asOf);
  res.json(rows);
});

router.post('/conversion-factors', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  for (const f of ['from_uom', 'to_uom', 'context', 'factor', 'effective_from']) {
    if (b[f] === undefined || b[f] === null || b[f] === '') {
      return res.status(400).json({ error: 'missing_field', field: f });
    }
  }
  if (typeof b.factor !== 'number' || b.factor <= 0) {
    return res.status(400).json({ error: 'invalid_factor' });
  }
  if (!isValidIsoDate(b.effective_from)) {
    return res.status(400).json({ error: 'invalid_date' });
  }
  const dup = db.prepare(`
    SELECT id FROM conversion_factors
     WHERE from_uom=? AND to_uom=? AND context=? AND effective_from=?
  `).get(b.from_uom, b.to_uom, b.context, b.effective_from);
  if (dup) {
    return res.status(409).json({
      error: 'duplicate_factor',
      hint: 'use a later effective_from for updates',
    });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO conversion_factors
    (id, from_uom, to_uom, context, factor, effective_from, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, b.from_uom, b.to_uom, b.context, b.factor,
      b.effective_from, b.notes ?? null, now, now
    );
  const row = db.prepare(`SELECT * FROM conversion_factors WHERE id=?`).get(id);
  res.status(201).json(row);
});

module.exports = router;
```

- [ ] **Step 4: Mount in index.js**

In `backend/src/index.js`:
- Require: `const conversionFactorsRoutes = require('./routes/conversion-factors');`
- Mount: `app.use('/api', conversionFactorsRoutes);`

- [ ] **Step 5: Restart, run tests**

```bash
kill $SERVER_PID 2>/dev/null; sleep 1
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
SERVER_PID=$!
sleep 3
npx vitest run tests/conversion-factors-api.test.js
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/conversion-factors.js backend/src/index.js \
        backend/tests/conversion-factors-api.test.js
git commit -m "feat(cloudskraal): GET/POST /api/conversion-factors"
```

---

## Task 6: Hook denominator into `/cost-of-production`

**Files:**
- Modify: `backend/src/routes/farms.js`
- Test: append to `backend/tests/cost-of-production-api.test.js`

- [ ] **Step 1: Append failing integration tests**

Append to `backend/tests/cost-of-production-api.test.js`:

```javascript
describe('cost-of-production denominator', () => {
  it('?denominator=dried returns cost-per-dried-kg', async () => {
    const { status, data } = await api(`/fields/${rooibosFieldId}/cost-of-production?year=2026&denominator=dried`);
    expect(status).toBe(200);
    expect(data.coverage.denominator).toBe('dried_kg');
    expect(Array.isArray(data.coverage.factors_used)).toBe(true);
    expect(data.coverage.factors_used.some(f => f.factor === 0.45)).toBe(true);
  });

  it('?denominator=netto_dry uses full chain', async () => {
    const { status, data } = await api(`/fields/${rooibosFieldId}/cost-of-production?year=2026&denominator=netto_dry`);
    expect(status).toBe(200);
    expect(data.coverage.denominator).toBe('sifted_netto_dry_kg');
    expect(data.coverage.factors_used).toHaveLength(2);
  });

  it('unreachable denominator returns 400 factor_missing', async () => {
    const { status, data } = await api(`/fields/${rooibosFieldId}/cost-of-production?year=2026&denominator=bogus_uom`);
    expect(status).toBe(400);
    expect(data.error).toBe('factor_missing');
  });
});
```

- [ ] **Step 2: Confirm fail**

Server already running. `npx vitest run tests/cost-of-production-api.test.js`.

- [ ] **Step 3: Update the route handler**

In `backend/src/routes/farms.js`, the `/fields/:id/cost-of-production` handler from spec 2a. Pass `opts.denominator` through and translate service errors to HTTP:

```javascript
router.get('/fields/:id/cost-of-production', (req, res) => {
  const db = getDb();
  const yearStr = req.query.year;
  if (!yearStr || isNaN(Number(yearStr))) {
    return res.status(400).json({ error: 'year_required' });
  }
  const year = Number(yearStr);
  const { computeFieldCop } = require('../services/cop');
  const report = computeFieldCop(db, req.params.id, year, {
    denominator: req.query.denominator,
  });
  if (!report) return res.status(404).json({ error: 'Field not found' });
  if (report.error) {
    return res.status(400).json(report);  // factor_missing, etc.
  }
  res.json(report);
});
```

- [ ] **Step 4: Restart + tests pass**

```bash
kill $SERVER_PID 2>/dev/null; sleep 1
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
SERVER_PID=$!
sleep 3
npx vitest run
```

Expected: all test files green.

- [ ] **Step 5: Kill server, commit**

```bash
kill $SERVER_PID 2>/dev/null; wait 2>/dev/null
git add backend/src/routes/farms.js backend/tests/cost-of-production-api.test.js
git commit -m "feat(cloudskraal): /cost-of-production accepts ?denominator=X"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full test suite**

```bash
lsof -ti:3001 | xargs kill 2>/dev/null; sleep 1
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
sleep 3
npx vitest run
lsof -ti:3001 | xargs kill 2>/dev/null; wait 2>/dev/null
```

Expected: every file green.

- [ ] **Step 2: Fresh DB end-to-end**

```bash
rm -f data/capex.db data/capex.db-shm data/capex.db-wal
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
sleep 4
grep -E "Seeded|Usage periods:|Migrated" /tmp/ck.log

FID=$(curl -sS http://localhost:3001/api/fields | node -e "
const fs=require('fs'); const d=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(d.find(f=>f.enterprise==='rooibos').id);
")
echo "rooibos field: $FID"

echo "--- netto_dry ---"
curl -sS "http://localhost:3001/api/fields/$FID/cost-of-production?year=2026&denominator=netto_dry" | python3 -m json.tool | head -60

echo "--- factors ---"
curl -sS "http://localhost:3001/api/conversion-factors?context=rooibos" | python3 -m json.tool

lsof -ti:3001 | xargs kill 2>/dev/null; wait 2>/dev/null
```

Expected: seed log lines present; COP response shows `coverage.denominator='sifted_netto_dry_kg'` and `factors_used` with two edges; factor list returns two rooibos rows.

- [ ] **Step 3: No further commit needed.**

---

## Done criteria

- [ ] Backend test suite green (cop-service, conversion-factors-api, cost-of-production-api, plus spec 2a tests).
- [ ] Fresh DB seed produces 2 rooibos factors.
- [ ] `GET /cost-of-production?denominator=netto_dry` returns correct dual-factor math and `factors_used[2]`.
- [ ] `POST /conversion-factors` creates, rejects duplicates with 409, rejects invalid inputs with 400.
- [ ] Spec 2a callers unaffected when `denominator` is omitted.
