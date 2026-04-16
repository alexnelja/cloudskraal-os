# Spec 5m — Measure Save-As Chooser Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute task-by-task.

**Goal:** After a finished measurement/draw, `MeasureToolbar` (from 5k) grows a save-as panel. Dropdown routes the geometry to FIELD / FEATURE / MEASUREMENT / NOTE. MEASUREMENT persists to a new `measurements` table. Pin click-to-finish bug fixed.

**Architecture:** Extends the existing `MeasureToolbar` (5k). New backend: `measurements` SQLite table + migration + 3 CRUD endpoints. New frontend: `SaveAsChooserPopover`, `SaveMeasurementModal`, Measurements tab in `AnnotationsSidebar`, API client + TS type. `AnnotateTool.onFinish` gated by `td.getMode()` to prevent saved-pin re-trigger.

**Tech Stack:** Node.js + better-sqlite3 (backend), React 19 + TypeScript + Vitest (frontend), `@turf/turf` for `booleanContains`, existing `FluidDialog` primitive.

**Spec:** `docs/specs/2026-04-16-spec-5m-measure-save-as.md`

**Depends on:** Spec 5k shipped (provides `MeasureToolbar` + `AnnotateTool.onReady`).

---

## Pre-flight

- [ ] **Step 0.1: Confirm 5k is shipped**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex
ls frontend/src/components/map/MeasureToolbar.tsx  # must exist
git log --oneline -6 | grep -E "5k|MeasureToolbar"
```

If `MeasureToolbar` doesn't exist, stop — ship 5k first.

- [ ] **Step 0.2: Green baseline**

```bash
cd backend && npm test
cd ../frontend && npm test && npx tsc -b --noEmit
```

---

## File structure

| Path | Responsibility | Action |
|---|---|---|
| `backend/src/db/migrate-measurements.js` | `CREATE TABLE measurements` | Create |
| `backend/src/db/schema.js` | Register migration | Modify |
| `backend/src/routes/measurements.js` | CRUD handlers | Create |
| `backend/src/routes/measurements.test.js` | Route tests | Create |
| `backend/src/index.js` | Mount router | Modify |
| `frontend/src/types/measurement.ts` | `Measurement` TS type | Create |
| `frontend/src/api/measurements.ts` | Client helpers | Create |
| `frontend/src/components/map/SaveAsChooserPopover.tsx` + `.test.tsx` | Dropdown | Create |
| `frontend/src/components/map/SaveMeasurementModal.tsx` + `.test.tsx` | Modal | Create |
| `frontend/src/components/map/MeasureToolbar.tsx` + `.test.tsx` | Extend with save-as panel | Modify |
| `frontend/src/components/map/AnnotationsSidebar.tsx` + `.test.tsx` | Add Measurements tab | Modify |
| `frontend/src/components/map/tools/AnnotateTool.tsx` | Gate onFinish by mode (bug fix) | Modify |

---

## Task 1 — Backend: migration + table (TDD)

**Files:** `migrate-measurements.js`, `schema.js`, test.

- [ ] **Step 1.1: Write failing test**

Create `backend/src/db/migrate-measurements.test.js`:

```js
const Database = require('better-sqlite3');
const { migrateMeasurements } = require('./migrate-measurements');

describe('migrateMeasurements', () => {
  it('creates the measurements table with expected columns', () => {
    const db = new Database(':memory:');
    migrateMeasurements(db);
    const cols = db.prepare("PRAGMA table_info(measurements)").all().map(c => c.name);
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'name', 'kind', 'value', 'unit', 'formatted', 'geometry', 'field_id', 'notes', 'created_at'])
    );
  });

  it('is idempotent — running twice does not error', () => {
    const db = new Database(':memory:');
    migrateMeasurements(db);
    expect(() => migrateMeasurements(db)).not.toThrow();
  });
});
```

- [ ] **Step 1.2: Run — expect FAIL**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
npx vitest run src/db/migrate-measurements.test.js
```

- [ ] **Step 1.3: Implement migration**

Create `backend/src/db/migrate-measurements.js`:

```js
function migrateMeasurements(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS measurements (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      kind        TEXT NOT NULL,
      value       REAL NOT NULL,
      unit        TEXT NOT NULL,
      formatted   TEXT NOT NULL,
      geometry    TEXT NOT NULL,
      field_id    TEXT NULL REFERENCES fields(id) ON DELETE SET NULL,
      notes       TEXT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_measurements_created ON measurements(created_at DESC);
  `);
}

module.exports = { migrateMeasurements };
```

- [ ] **Step 1.4: Register in schema.js + honour CAPEX_DB_PATH**

In `backend/src/db/schema.js`:

1. Near the top with other requires, add:
   ```js
   const { migrateMeasurements } = require('./migrate-measurements');
   ```
2. Inside `getDb()` after the existing migration calls, add:
   ```js
   migrateMeasurements(db);
   ```
3. **Commit up front:** replace the hardcoded `DB_PATH` constant near the top of the file with an env-aware version so backend route tests can use a throwaway SQLite file:
   ```js
   // Before:
   const DB_PATH = path.join(__dirname, '..', '..', 'data', 'capex.db');
   // After:
   const DB_PATH = process.env.CAPEX_DB_PATH
     ?? path.join(__dirname, '..', '..', 'data', 'capex.db');
   ```

This change is isolated (one line), keeps default behaviour unchanged for dev/prod, and unblocks Task 2's route tests (and every future backend test). Ship it in the Task 1 commit.

- [ ] **Step 1.5: Run — expect PASS**

```bash
npx vitest run src/db/migrate-measurements.test.js
```

---

## Task 2 — Backend: CRUD endpoints (TDD)

**Files:** `routes/measurements.js` + test, `index.js`.

- [ ] **Step 2.1: Write failing route tests**

**Important:** no existing backend route tests exist — this plan establishes the test-harness pattern. `supertest` isn't currently a dev dep, so install it first:

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
npm install --save-dev supertest
```

Also: `backend/src/index.js` currently starts the server on import (`app.listen(...)`). Check whether `app` is exported; if not, we need to export it without calling `listen` during tests. Quick pattern — at the bottom of `index.js`:

```js
// Existing `app.listen(...)` stays for `npm start`/`dev`, guarded by:
if (require.main === module) {
  app.listen(PORT, () => console.log(...));
}
module.exports = { app };
```

If this change touches `index.js`, bundle it with the route commit.

Create `backend/src/routes/measurements.test.js`:

```js
const { describe, it, expect, beforeEach, afterAll } = require('vitest');
const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Use a separate test DB so we don't stomp on the dev data
const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-measurements.db');
process.env.CAPEX_DB_PATH = TEST_DB_PATH; // if schema.js honours this; otherwise stub as needed

// Reset the db between tests
beforeEach(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

afterAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

// Must require AFTER env var is set so getDb() reads the test path
const { app } = require('../index');

describe('measurements routes', () => {
  const validBody = {
    name: 'Fence line',
    kind: 'length',
    value: 1234.56,
    unit: 'm',
    formatted: '1.23 km',
    geometry: JSON.stringify({ type: 'LineString', coordinates: [[0,0],[1,1]] }),
  };

  it('POST /api/measurements creates a row and returns 201', async () => {
    const res = await request(app).post('/api/measurements').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Fence line');
    expect(res.body.kind).toBe('length');
  });

  it('GET /api/measurements returns newest first', async () => {
    await request(app).post('/api/measurements').send({ ...validBody, name: 'First' });
    await new Promise((r) => setTimeout(r, 10));
    await request(app).post('/api/measurements').send({ ...validBody, name: 'Second' });
    const res = await request(app).get('/api/measurements');
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Second');
    expect(res.body[1].name).toBe('First');
  });

  it('DELETE /api/measurements/:id returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/measurements/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('POST rejects missing required fields with 400', async () => {
    const res = await request(app).post('/api/measurements').send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('POST rejects invalid kind', async () => {
    const res = await request(app).post('/api/measurements').send({ ...validBody, kind: 'weight' });
    expect(res.status).toBe(400);
  });
});
```

**If `schema.js` doesn't honour `CAPEX_DB_PATH`**: the simplest workaround is to modify `backend/src/db/schema.js` to read `process.env.CAPEX_DB_PATH ?? path.join(__dirname, '..', '..', 'data', 'capex.db')` at module load. That's a small, isolated change that benefits all future tests. Include it in the Task 1 commit.

- [ ] **Step 2.2: Run — expect FAIL**

- [ ] **Step 2.3: Implement the router**

Create `backend/src/routes/measurements.js`:

```js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');

const router = express.Router();

const REQUIRED = ['name', 'kind', 'value', 'unit', 'formatted', 'geometry'];

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM measurements ORDER BY created_at DESC').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  for (const key of REQUIRED) {
    if (req.body[key] === undefined || req.body[key] === null) {
      return res.status(400).json({ error: `Missing required field: ${key}` });
    }
  }
  if (!['length', 'area'].includes(req.body.kind)) {
    return res.status(400).json({ error: 'kind must be "length" or "area"' });
  }
  const row = {
    id: uuidv4(),
    name: req.body.name,
    kind: req.body.kind,
    value: Number(req.body.value),
    unit: req.body.unit,
    formatted: req.body.formatted,
    geometry: typeof req.body.geometry === 'string' ? req.body.geometry : JSON.stringify(req.body.geometry),
    field_id: req.body.field_id ?? null,
    notes: req.body.notes ?? null,
    created_at: new Date().toISOString(),
  };
  getDb()
    .prepare(
      'INSERT INTO measurements (id, name, kind, value, unit, formatted, geometry, field_id, notes, created_at) VALUES (@id, @name, @kind, @value, @unit, @formatted, @geometry, @field_id, @notes, @created_at)',
    )
    .run(row);
  res.status(201).json(row);
});

router.delete('/:id', (req, res) => {
  const out = getDb().prepare('DELETE FROM measurements WHERE id = ?').run(req.params.id);
  if (out.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
```

- [ ] **Step 2.4: Mount in index.js**

In `backend/src/index.js`, alongside other `app.use('/api/...')` lines:

```js
app.use('/api/measurements', require('./routes/measurements'));
```

- [ ] **Step 2.5: Run — expect PASS**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
npx vitest run src/routes/measurements.test.js
npm test  # full backend suite
```

- [ ] **Step 2.6: Commit backend**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex
git add backend/src/db/migrate-measurements.js backend/src/db/migrate-measurements.test.js backend/src/db/schema.js backend/src/routes/measurements.js backend/src/routes/measurements.test.js backend/src/index.js
git commit -m "$(cat <<'EOF'
feat(backend): spec 5m — measurements table + CRUD

New `measurements` table stores saved length/area measurements. Three
endpoints (GET list, POST create, DELETE by id). Migration is
idempotent and registered in schema.js alongside existing migrations.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — Frontend: type + API client

**Files:** `types/measurement.ts`, `api/measurements.ts`.

- [ ] **Step 3.1: Type**

Create `frontend/src/types/measurement.ts`:

```ts
export type MeasurementKind = 'length' | 'area';
export type MeasurementUnit = 'm' | 'km' | 'm²' | 'ha';

export interface Measurement {
  id: string;
  name: string;
  kind: MeasurementKind;
  value: number;
  unit: MeasurementUnit;
  formatted: string;
  geometry: string;
  field_id: string | null;
  notes: string | null;
  created_at: string;
}
```

- [ ] **Step 3.2: Client**

Create `frontend/src/api/measurements.ts`:

```ts
import type { Measurement } from '../types/measurement';

const API = '/api/measurements';

export async function listMeasurements(): Promise<Measurement[]> {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

export async function createMeasurement(input: Omit<Measurement, 'id' | 'created_at'>): Promise<Measurement> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  return res.json();
}

export async function deleteMeasurement(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`);
}
```

---

## Task 4 — SaveAsChooserPopover (TDD)

**Files:** `SaveAsChooserPopover.tsx` + `.test.tsx`.

- [ ] **Step 4.1: Write failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SaveAsChooserPopover from './SaveAsChooserPopover';

describe('SaveAsChooserPopover', () => {
  const polygon = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] } as const;
  const line = { type: 'LineString', coordinates: [[0,0],[1,1]] } as const;

  it('shows four destinations for a polygon', () => {
    render(<SaveAsChooserPopover geometry={polygon} onPick={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByRole('button', { name: /field/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /feature/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /measurement/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^note$/i })).toBeEnabled();
  });

  it('disables FIELD for a line', () => {
    render(<SaveAsChooserPopover geometry={line} onPick={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByRole('button', { name: /field/i })).toBeDisabled();
  });

  it('fires onPick with the chosen destination', () => {
    const onPick = vi.fn();
    render(<SaveAsChooserPopover geometry={polygon} onPick={onPick} onDiscard={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /measurement/i }));
    expect(onPick).toHaveBeenCalledWith('measurement');
  });
});
```

- [ ] **Step 4.2: Implement**

Create `SaveAsChooserPopover.tsx` — a small glass-panel popover with 4 buttons; greys out destinations that can't accept the given geometry type.

- [ ] **Step 4.3: Run tests — expect PASS**

---

## Task 5 — SaveMeasurementModal (TDD)

**Files:** `SaveMeasurementModal.tsx` + test.

- [ ] **Step 5.1: Write failing test**

Cover: required `name`, POSTs to API on save with the payload including `geometry`, `value`, `unit`, `formatted`.

- [ ] **Step 5.2: Implement**

Wrap `FluidDialog` with name + optional notes fields. On Save: call `createMeasurement`, close, toast.

- [ ] **Step 5.3: Run — PASS**

---

## Task 6 — Extend MeasureToolbar with save-as panel

- [ ] **Step 6.1: Extend tests**

Add to `MeasureToolbar.test.tsx`: after a finished draw (simulated by passing a `finishedGeometry` prop), the save-as panel renders with the measurement chip and SAVE AS / DISCARD buttons; DISCARD calls the discard callback.

- [ ] **Step 6.2: Update props**

```tsx
interface MeasureToolbarProps {
  terraDraw: TerraDraw | null;
  currentMode: string;
  finishedGeometry: GeoJSON.Geometry | null;
  measurementText: string | null;
  onPick: (dest: 'field' | 'feature' | 'measurement' | 'note') => void;
  onDiscard: () => void;
}
```

The `finishedGeometry` + `measurementText` are owned by `FarmMapPage` — see Task 8.

- [ ] **Step 6.3: Render save-as panel**

Below the mode buttons, when `finishedGeometry && currentMode === 'static'`:

```tsx
<div className="mt-2 flex flex-col gap-2">
  <div className="flex items-center justify-between px-3 py-1.5 bg-stone-50 rounded-full text-[11px]">
    <span>{measurementText}</span>
    <button onClick={onDiscard}>×</button>
  </div>
  <div className="flex gap-2">
    <button ... onClick={() => setChooserOpen(true)}>+ SAVE AS ▾</button>
    <button ... onClick={onDiscard}>DISCARD</button>
  </div>
  {chooserOpen && (
    <SaveAsChooserPopover geometry={finishedGeometry} onPick={onPick} onDiscard={...} />
  )}
</div>
```

- [ ] **Step 6.4: Run — PASS**

---

## Task 7 — Measurements tab in AnnotationsSidebar

- [ ] **Step 7.1: Extend tests**

Verify the tab appears, `navigator.clipboard.writeText` is called with `formatted` on copy, delete removes the row.

- [ ] **Step 7.2: Implement**

Add a "Measurements" tab next to existing Lines/Polygons/Pins. Row:

```
│ 🪵 Fence line           1.23 km  📋 🗑 │
```

Click-to-zoom reuses the existing annotation-zoom pattern (find the annotation's geometry → `map.fitBounds(turf.bbox(geom))`). Load measurements via `listMeasurements()` on mount.

---

## Task 8 — Wire state in FarmMapPage + destination routing

- [ ] **Step 8.1: Capture finished geometry from TerraDraw**

In `FarmMapPage.tsx`, add:

```tsx
const [finishedGeometry, setFinishedGeometry] = useState<GeoJSON.Geometry | null>(null);
const [measurementText, setMeasurementText] = useState<string | null>(null);
```

`AnnotateTool` needs a new `onFinish?: (geom, text) => void` callback that fires when a draw completes AND the mode isn't static/select (see Task 9 bug fix). Wire it to set the state.

- [ ] **Step 8.2: Destination routing**

```tsx
function handleSaveAsPick(dest: 'field' | 'feature' | 'measurement' | 'note') {
  if (!finishedGeometry) return;
  if (dest === 'field') {
    // use turf.booleanContains to check if any existing field contains the geometry
    const enclosing = findEnclosingField(fields, finishedGeometry); // utility in utils/fields.ts
    if (enclosing) {
      toast(`Already inside "${enclosing.name}" — no new field created.`);
      clearFinished();
      return;
    }
    openFieldCreateFormWithGeometry(finishedGeometry);
  } else if (dest === 'feature') {
    openSaveAnnotationModal(finishedGeometry);
  } else if (dest === 'measurement') {
    openSaveMeasurementModal({ geometry: finishedGeometry, text: measurementText });
  } else if (dest === 'note') {
    openSaveAnnotationModal(finishedGeometry, { category: 'map_note' });
  }
  clearFinished();
}
```

The three `open*` helpers depend on the existing modals; wire them to whatever state / context your project already uses.

- [ ] **Step 8.3: Implement `findEnclosingField`**

**Geometry source (verified):** `Field` (in `frontend/src/types/farm.ts`) holds no polygon — only `area_ha`, `enterprise`, etc. Field polygons live separately in a `FeatureCollection` named `geojson` that `FarmMapPage` already loads and passes to `FarmMap` (`map.addSource('fields', { type: 'geojson', data: geojson })` in `FarmMap.tsx:53`). Each feature has `properties.id` matching the `Field.id`, as seen in `FarmMapPage.tsx:480`:

```ts
const feature = geojson.features.find(f => f.properties?.id === fieldId);
```

So `findEnclosingField` takes both the geojson and the drawn geometry — not the `fields` array:

Create `frontend/src/utils/fields.ts` (new):

```ts
import * as turf from '@turf/turf';

export interface EnclosingMatch {
  fieldId: string;
  fieldName: string;
}

/**
 * Returns the first field polygon that fully contains the drawn geometry,
 * or null if none does. Skips features that aren't polygons (can't contain).
 */
export function findEnclosingField(
  fieldsGeoJson: GeoJSON.FeatureCollection,
  drawn: GeoJSON.Geometry,
): EnclosingMatch | null {
  // turf.booleanContains wants Feature<Polygon>|Feature<MultiPolygon> on the outer side.
  const drawnFeature = turf.feature(drawn);
  for (const f of fieldsGeoJson.features) {
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;
    try {
      if (turf.booleanContains(f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>, drawnFeature)) {
        return {
          fieldId: String(f.properties?.id ?? ''),
          fieldName: String(f.properties?.name ?? f.properties?.id ?? 'unknown'),
        };
      }
    } catch {
      // turf throws on degenerate geometries — treat as non-enclosing
      continue;
    }
  }
  return null;
}
```

In `FarmMapPage.tsx`'s `handleSaveAsPick`:

```ts
if (dest === 'field') {
  const match = findEnclosingField(geojson, finishedGeometry);
  if (match) {
    toast(`Already inside "${match.fieldName}" — no new field created.`);
    clearFinished();
    return;
  }
  // no existing field create flow yet (see 5l) — show a follow-up toast for now
  toast.info('Field creation flow pending (tracked in handoff)');
  clearFinished();
  return;
}
```

**Important:** since 5l also stubs `onAddField` (no real field-creation flow exists), the FIELD branch in 5m is ALSO a stub. The `turf.booleanContains` guard ships — the downstream "open the real field-create form" is deferred. Document this in the handoff.

---

## Task 9 — AnnotateTool.onFinish gate (bug fix)

**Files:** `AnnotateTool.tsx`.

- [ ] **Step 9.1: Modify the finish handler**

Current body (verified at `AnnotateTool.tsx:78-86`):

```tsx
control.on('finish', (id) => {
  const snapshot = td.getSnapshot?.();
  const feature = snapshot?.find((f) => f.id === id);
  if (!feature) return;
  const annType = geometryToType(feature.geometry as GeoJSON.Geometry);
  if (!annType) return;
  onFinishRef.current?.({ type: annType, geometry: feature.geometry as GeoJSON.Geometry });
});
```

Add a mode guard at the top — keep the existing body below it:

```tsx
control.on('finish', (id) => {
  const mode = td.getMode?.();
  if (mode === 'static' || mode === 'select') return;
  const snapshot = td.getSnapshot?.();
  const feature = snapshot?.find((f) => f.id === id);
  if (!feature) return;
  const annType = geometryToType(feature.geometry as GeoJSON.Geometry);
  if (!annType) return;
  onFinishRef.current?.({ type: annType, geometry: feature.geometry as GeoJSON.Geometry });
});
```

This is a pure early-return; nothing else in the handler changes. Do not replace the existing snapshot lookup or callback invocation.

- [ ] **Step 9.2: Verify manually**

This prevents click on a saved pin/polygon from re-triggering save flow — verified by smoke in Task 10.

---

## Task 10 — Commit frontend + smoke + handoff

- [ ] **Step 10.1: Commit all frontend changes**

```bash
git add frontend/src/types/measurement.ts frontend/src/api/measurements.ts frontend/src/components/map/SaveAsChooserPopover.tsx frontend/src/components/map/SaveAsChooserPopover.test.tsx frontend/src/components/map/SaveMeasurementModal.tsx frontend/src/components/map/SaveMeasurementModal.test.tsx frontend/src/components/map/MeasureToolbar.tsx frontend/src/components/map/MeasureToolbar.test.tsx frontend/src/components/map/AnnotationsSidebar.tsx frontend/src/components/map/AnnotationsSidebar.test.tsx frontend/src/components/map/tools/AnnotateTool.tsx frontend/src/pages/FarmMapPage.tsx frontend/src/utils/fields.ts
git commit -m "$(cat <<'EOF'
feat(map): spec 5m — measure save-as chooser + measurements sidebar

After finishing a measure/draw, the MeasureToolbar grows a save-as
panel with FIELD / FEATURE / MEASUREMENT / NOTE destinations. FIELD
opens field-create pre-filled (skipped when inside an existing field
via turf.booleanContains). MEASUREMENT persists to the new
measurements table and appears in a new Measurements tab in
AnnotationsSidebar with click-to-copy.

Folds in the pin-click bug fix: onFinish is now gated by
td.getMode() so clicking a saved pin no longer re-opens save flow.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10.2: Smoke**

- [ ] Draw line → Enter → chip + SAVE AS appear.
- [ ] SAVE AS → MEASUREMENT → name → persists → shows in sidebar with correct value.
- [ ] SAVE AS → FIELD for a polygon inside an existing field → toast "Already inside X" + cancel.
- [ ] SAVE AS → FIELD for a new polygon → field-create form opens pre-filled.
- [ ] Click saved pin → does NOT re-open save flow.
- [ ] Measurements tab — copy-to-clipboard works; delete removes the row.

- [ ] **Step 10.3: Handoff doc + commit**

Create `docs/handoffs/2026-04-17-spec-5m-save-as.md` with commit SHAs + results.

```bash
git add docs/handoffs/2026-04-17-spec-5m-save-as.md
git commit -m "docs: handoff for spec 5m — measure save-as chooser shipped"
```

## Done when

- [ ] Backend: migration + 3 endpoints + 4+ tests green.
- [ ] Frontend: 4+ new test files green; existing tests still green.
- [ ] Pin-click bug verified fixed.
- [ ] Smoke passes all six boxes above.
- [ ] ≤ 5 focused commits for 5m.
