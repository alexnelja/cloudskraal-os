# Task Manager Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data model (tags, custom statuses, task_tags junction) with safe migration, backend CRUD routes, frontend types/API layer, and a basic Today view page with task list and simple creation form.

**Architecture:** Extends the existing Express + SQLite backend with 4 new tables and a new route file. Frontend adds a `/tasks` page with a Today view showing tasks grouped by time. Follows existing patterns from `calendar.js` routes and `CalendarPage.tsx`.

**Tech Stack:** Express, better-sqlite3, React, TypeScript, Tailwind CSS, Vitest, motion/react, @phosphor-icons/react

**Spec:** `docs/specs/2026-04-18-task-manager-design.md`

---

## File Structure

### Backend (new files)
- `backend/src/db/schema-tasks.js` — CREATE TABLE for tags, task_tags, task_statuses, task_templates
- `backend/src/db/migrate-task-status-id.js` — Safe three-phase status migration
- `backend/src/routes/tasks.js` — New route file for task manager endpoints (tags, statuses CRUD)
- `backend/tests/task-tags-api.test.js` — Integration tests for tags + statuses API
- `backend/tests/task-status-migration.test.js` — Migration safety test

### Backend (modified files)
- `backend/src/db/schema.js` — Register new schema + migration
- `backend/src/index.js` — Mount new routes

### Frontend (new files)
- `frontend/src/types/taskManager.ts` — Tag, TaskStatus, TaskTemplate types
- `frontend/src/api/taskManager.ts` — API functions for tags, statuses
- `frontend/src/pages/TaskManagerPage.tsx` — Main page with Today view
- `frontend/src/pages/TaskManagerPage.test.tsx` — Page render tests
- `frontend/src/components/tasks/TodayView.tsx` — Today task list component
- `frontend/src/components/tasks/TodayView.test.tsx` — Today view tests
- `frontend/src/components/tasks/TaskRow.tsx` — Single task row with completion
- `frontend/src/components/tasks/TaskRow.test.tsx` — Task row tests
- `frontend/src/components/tasks/TaskCreateForm.tsx` — Expanded task creation form
- `frontend/src/components/tasks/TaskCreateForm.test.tsx` — Form tests
- `frontend/src/components/tasks/DailyProgress.tsx` — Progress bar component
- `frontend/src/components/tasks/DailyProgress.test.tsx` — Progress bar tests

### Frontend (modified files)
- `frontend/src/types/calendar.ts` — Add status_id, tags fields to Task interface
- `frontend/src/components/Sidebar.tsx` — Add Tasks nav item
- `frontend/src/App.tsx` — Add /tasks route

---

## Task 1: Database Schema — New Tables

**Files:**
- Create: `backend/src/db/schema-tasks.js`
- Modify: `backend/src/db/schema.js`

- [ ] **Step 1: Write the schema file**

Create `backend/src/db/schema-tasks.js`:

```javascript
const { v4: uuidv4 } = require('uuid');

function initTaskManagerSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL DEFAULT 'cloudskraal',
      name TEXT NOT NULL,
      color TEXT DEFAULT '#9ca3af',
      "group" TEXT DEFAULT 'custom',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      UNIQUE(task_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS task_statuses (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL DEFAULT 'cloudskraal',
      name TEXT NOT NULL,
      color TEXT DEFAULT '#9ca3af',
      category TEXT NOT NULL DEFAULT 'active',
      sort_order INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS task_templates (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL DEFAULT 'cloudskraal',
      name TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      priority TEXT DEFAULT 'medium',
      estimated_minutes INTEGER,
      checklist_items TEXT,
      input_defaults TEXT,
      recurrence_rule TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_tags_farm ON tags(farm_id);
    CREATE INDEX IF NOT EXISTS idx_task_statuses_farm ON task_statuses(farm_id);
  `);
}

function seedDefaultTags(db) {
  const existing = db.prepare('SELECT COUNT(*) as c FROM tags').get();
  if (existing.c > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(
    'INSERT INTO tags (id, farm_id, name, color, "group", sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const categories = [
    { name: 'Crop Ops', color: '#047857', group: 'category' },
    { name: 'Livestock Ops', color: '#d97706', group: 'category' },
    { name: 'Infrastructure', color: '#6b7280', group: 'category' },
    { name: 'Procurement', color: '#7c3aed', group: 'category' },
    { name: 'Labour', color: '#2563eb', group: 'category' },
    { name: 'Compliance', color: '#dc2626', group: 'category' },
    { name: 'Financial', color: '#0d9488', group: 'category' },
  ];

  const enterprises = [
    { name: 'Rooibos', color: '#047857', group: 'enterprise' },
    { name: 'Wine', color: '#7c3aed', group: 'enterprise' },
    { name: 'Sheep', color: '#d97706', group: 'enterprise' },
    { name: 'Fallow', color: '#9ca3af', group: 'enterprise' },
  ];

  const all = [...categories, ...enterprises];
  all.forEach((t, i) => {
    insert.run(uuidv4(), 'cloudskraal', t.name, t.color, t.group, i, now);
  });
}

function seedDefaultStatuses(db) {
  const existing = db.prepare('SELECT COUNT(*) as c FROM task_statuses').get();
  if (existing.c > 0) return;

  const insert = db.prepare(
    'INSERT INTO task_statuses (id, farm_id, name, color, category, sort_order, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const statuses = [
    { name: 'Todo', color: '#9ca3af', category: 'active', isDefault: 1 },
    { name: 'In Progress', color: '#3b82f6', category: 'active', isDefault: 0 },
    { name: 'Blocked', color: '#ef4444', category: 'active', isDefault: 0 },
    { name: 'Completed', color: '#22c55e', category: 'done', isDefault: 0 },
    { name: 'Skipped', color: '#a1a1aa', category: 'closed', isDefault: 0 },
    { name: 'Verified', color: '#8b5cf6', category: 'done', isDefault: 0 },
  ];

  statuses.forEach((s, i) => {
    insert.run(uuidv4(), 'cloudskraal', s.name, s.color, s.category, i, s.isDefault);
  });
}

module.exports = { initTaskManagerSchema, seedDefaultTags, seedDefaultStatuses };
```

- [ ] **Step 2: Register schema in schema.js**

In `backend/src/db/schema.js`, add after existing requires:
```javascript
const { initTaskManagerSchema, seedDefaultTags, seedDefaultStatuses } = require('./schema-tasks');
```

Inside `initSchema(db)` function, add after existing schema calls:
```javascript
initTaskManagerSchema(db);
seedDefaultTags(db);
seedDefaultStatuses(db);
```

- [ ] **Step 3: Verify tables created**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
node -e "const {getDb}=require('./src/db/schema'); const db=getDb(); console.log(db.prepare('SELECT name FROM sqlite_master WHERE type=\"table\" AND name IN (\"tags\",\"task_tags\",\"task_statuses\",\"task_templates\")').all())"
```

Expected: 4 tables listed.

- [ ] **Step 4: Verify seeds**

```bash
node -e "const {getDb}=require('./src/db/schema'); const db=getDb(); console.log('Tags:', db.prepare('SELECT COUNT(*) as c FROM tags').get()); console.log('Statuses:', db.prepare('SELECT COUNT(*) as c FROM task_statuses').get())"
```

Expected: Tags: 11, Statuses: 6

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/schema-tasks.js backend/src/db/schema.js
git commit -m "feat(tasks): add tags, task_tags, task_statuses, task_templates tables with defaults"
```

---

## Task 2: Status Migration — Safe Three-Phase

**Files:**
- Create: `backend/src/db/migrate-task-status-id.js`
- Create: `backend/tests/task-status-migration.test.js`
- Modify: `backend/src/db/schema.js`

- [ ] **Step 1: Write migration file**

Create `backend/src/db/migrate-task-status-id.js`:

```javascript
function migrateTaskStatusId(db) {
  const cols = db.prepare('PRAGMA table_info(tasks)').all().map(c => c.name);

  // Phase 1: Add status_id column if not exists
  if (!cols.includes('status_id')) {
    db.exec('ALTER TABLE tasks ADD COLUMN status_id TEXT REFERENCES task_statuses(id)');
  }

  // Phase 2: Backfill status_id from status text for rows that have status but no status_id
  const unmapped = db.prepare(
    'SELECT DISTINCT status FROM tasks WHERE status IS NOT NULL AND status_id IS NULL'
  ).all();

  for (const { status } of unmapped) {
    const match = db.prepare(
      'SELECT id FROM task_statuses WHERE LOWER(name) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1'
    ).get(status, status.replace(/_/g, ' '));

    if (match) {
      db.prepare('UPDATE tasks SET status_id = ? WHERE status = ? AND status_id IS NULL')
        .run(match.id, status);
    }
  }

  // Add additional task manager columns
  if (!cols.includes('estimated_minutes')) {
    db.exec('ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER');
  }
  if (!cols.includes('actual_minutes')) {
    db.exec('ALTER TABLE tasks ADD COLUMN actual_minutes INTEGER');
  }
  if (!cols.includes('blocked_reason')) {
    db.exec('ALTER TABLE tasks ADD COLUMN blocked_reason TEXT');
  }
  if (!cols.includes('blocked_until')) {
    db.exec('ALTER TABLE tasks ADD COLUMN blocked_until TEXT');
  }
  if (!cols.includes('sort_order')) {
    db.exec('ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0');
  }
  if (!cols.includes('verified_by')) {
    db.exec('ALTER TABLE tasks ADD COLUMN verified_by TEXT');
  }
  if (!cols.includes('verified_at')) {
    db.exec('ALTER TABLE tasks ADD COLUMN verified_at TEXT');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_status_id ON tasks(status_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
}

module.exports = { migrateTaskStatusId };
```

- [ ] **Step 2: Register migration in schema.js**

Add require and call in `initSchema()`:
```javascript
const { migrateTaskStatusId } = require('./migrate-task-status-id');
// ... inside initSchema, after initTaskManagerSchema:
migrateTaskStatusId(db);
```

- [ ] **Step 3: Write migration safety test**

Create `backend/tests/task-status-migration.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'capex.db');

describe('task status migration', () => {
  it('tasks table has status_id column', () => {
    const db = new Database(DB_PATH);
    const cols = db.prepare('PRAGMA table_info(tasks)').all().map(c => c.name);
    expect(cols).toContain('status_id');
    db.close();
  });

  it('task_statuses has 6 default statuses', () => {
    const db = new Database(DB_PATH);
    const count = db.prepare('SELECT COUNT(*) as c FROM task_statuses').get();
    expect(count.c).toBeGreaterThanOrEqual(6);
    db.close();
  });

  it('default statuses include Todo, Blocked, Verified', () => {
    const db = new Database(DB_PATH);
    const names = db.prepare('SELECT name FROM task_statuses ORDER BY sort_order').all().map(r => r.name);
    expect(names).toContain('Todo');
    expect(names).toContain('Blocked');
    expect(names).toContain('Verified');
    db.close();
  });

  it('existing tasks with status text have status_id backfilled', () => {
    const db = new Database(DB_PATH);
    const orphaned = db.prepare(
      'SELECT COUNT(*) as c FROM tasks WHERE status IS NOT NULL AND status_id IS NULL'
    ).get();
    expect(orphaned.c).toBe(0);
    db.close();
  });
});
```

- [ ] **Step 4: Restart backend and run migration**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
lsof -ti:3001 | xargs kill 2>/dev/null; sleep 1; PORT=3001 node src/index.js &
sleep 2
```

- [ ] **Step 5: Run migration test**

```bash
npm test -- tests/task-status-migration.test.js
```

Expected: 4 tests pass.

- [ ] **Step 6: Run full backend suite**

```bash
npm test
```

Expected: All tests pass (no regressions).

- [ ] **Step 7: Commit**

```bash
git add backend/src/db/migrate-task-status-id.js backend/src/db/schema.js backend/tests/task-status-migration.test.js
git commit -m "feat(tasks): safe three-phase status_id migration with backfill"
```

---

## Task 3: Backend Routes — Tags & Statuses CRUD

**Files:**
- Create: `backend/src/routes/tasks.js`
- Create: `backend/tests/task-tags-api.test.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/task-tags-api.test.js`:

```javascript
import { describe, it, expect } from 'vitest';

const BASE = 'http://localhost:3001/api';

async function api(p, options = {}) {
  const res = await fetch(`${BASE}${p}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

describe('tags API', () => {
  it('GET /tags returns seeded tags', async () => {
    const { status, data } = await api('/tags');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(11);
  });

  it('GET /tags?group=enterprise returns only enterprise tags', async () => {
    const { status, data } = await api('/tags?group=enterprise');
    expect(status).toBe(200);
    expect(data.every(t => t.group === 'enterprise')).toBe(true);
  });

  it('POST /tags creates a custom tag', async () => {
    const { status, data } = await api('/tags', {
      method: 'POST',
      body: JSON.stringify({ name: '__TEST_TAG__', color: '#ff0000', group: 'custom' }),
    });
    expect(status).toBe(201);
    expect(data.name).toBe('__TEST_TAG__');
    expect(data.id).toBeTruthy();
    // cleanup
    await api(`/tags/${data.id}`, { method: 'DELETE' });
  });

  it('DELETE /tags/:id removes tag', async () => {
    const { data: created } = await api('/tags', {
      method: 'POST',
      body: JSON.stringify({ name: '__DEL_TAG__', color: '#000' }),
    });
    const { status } = await api(`/tags/${created.id}`, { method: 'DELETE' });
    expect(status).toBe(204);
  });
});

describe('task-statuses API', () => {
  it('GET /task-statuses returns defaults', async () => {
    const { status, data } = await api('/task-statuses');
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(6);
    expect(data.some(s => s.name === 'Todo')).toBe(true);
  });

  it('POST /task-statuses creates a custom status', async () => {
    const { status, data } = await api('/task-statuses', {
      method: 'POST',
      body: JSON.stringify({ name: '__TEST_STATUS__', color: '#00ff00', category: 'active' }),
    });
    expect(status).toBe(201);
    expect(data.name).toBe('__TEST_STATUS__');
    // cleanup
    await api(`/task-statuses/${data.id}`, { method: 'DELETE' });
  });

  it('PATCH /task-statuses/:id updates color', async () => {
    const { data: created } = await api('/task-statuses', {
      method: 'POST',
      body: JSON.stringify({ name: '__PATCH_STATUS__', color: '#111', category: 'active' }),
    });
    const { status, data } = await api(`/task-statuses/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ color: '#222' }),
    });
    expect(status).toBe(200);
    expect(data.color).toBe('#222');
    await api(`/task-statuses/${created.id}`, { method: 'DELETE' });
  });
});

describe('task-tags linking', () => {
  it('POST /tasks/:id/tags links a tag', async () => {
    const { data: tags } = await api('/tags');
    const tagId = tags[0].id;
    const { data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: '__TAG_LINK_TEST__' }),
    });
    const { status } = await api(`/tasks/${task.id}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_id: tagId }),
    });
    expect(status).toBe(201);
    // verify
    const { data: fetched } = await api(`/tasks/${task.id}`);
    expect(fetched.tags).toBeDefined();
    expect(fetched.tags.some(t => t.id === tagId)).toBe(true);
    // cleanup
    await api(`/tasks/${task.id}`, { method: 'DELETE' });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- tests/task-tags-api.test.js
```

Expected: FAIL (routes don't exist yet).

- [ ] **Step 3: Write routes**

Create `backend/src/routes/tasks.js`:

```javascript
const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');

const router = Router();

// ── Tags ──

router.get('/tags', (req, res) => {
  const db = getDb();
  const { group } = req.query;
  let sql = 'SELECT * FROM tags WHERE farm_id = ? ORDER BY sort_order, name';
  const params = ['cloudskraal'];
  if (group) {
    sql = 'SELECT * FROM tags WHERE farm_id = ? AND "group" = ? ORDER BY sort_order, name';
    params.push(group);
  }
  res.json(db.prepare(sql).all(...params));
});

router.post('/tags', (req, res) => {
  const db = getDb();
  const { name, color, group } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = uuidv4();
  const now = new Date().toISOString();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM tags WHERE farm_id = ?').get('cloudskraal');
  db.prepare(
    'INSERT INTO tags (id, farm_id, name, color, "group", sort_order, created_at) VALUES (?,?,?,?,?,?,?)'
  ).run(id, 'cloudskraal', name, color || '#9ca3af', group || 'custom', (maxOrder?.m ?? -1) + 1, now);
  res.status(201).json(db.prepare('SELECT * FROM tags WHERE id = ?').get(id));
});

router.patch('/tags/:id', (req, res) => {
  const db = getDb();
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: 'not found' });
  const allowed = ['name', 'color', 'group', 'sort_order'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length > 0) {
    const sets = Object.keys(updates).map(k => k === 'group' ? `"group" = ?` : `${k} = ?`).join(', ');
    db.prepare(`UPDATE tags SET ${sets} WHERE id = ?`).run(...Object.values(updates), req.params.id);
  }
  res.json(db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id));
});

router.delete('/tags/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM task_tags WHERE tag_id = ?').run(req.params.id);
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ── Task Statuses ──

router.get('/task-statuses', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM task_statuses WHERE farm_id = ? ORDER BY sort_order').all('cloudskraal'));
});

router.post('/task-statuses', (req, res) => {
  const db = getDb();
  const { name, color, category } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!['active', 'done', 'closed'].includes(category)) {
    return res.status(400).json({ error: 'category must be active, done, or closed' });
  }
  const id = uuidv4();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM task_statuses WHERE farm_id = ?').get('cloudskraal');
  db.prepare(
    'INSERT INTO task_statuses (id, farm_id, name, color, category, sort_order, is_default) VALUES (?,?,?,?,?,?,0)'
  ).run(id, 'cloudskraal', name, color || '#9ca3af', category, (maxOrder?.m ?? -1) + 1);
  res.status(201).json(db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(id));
});

router.patch('/task-statuses/:id', (req, res) => {
  const db = getDb();
  const status = db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(req.params.id);
  if (!status) return res.status(404).json({ error: 'not found' });
  const allowed = ['name', 'color', 'category', 'sort_order', 'is_default'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length > 0) {
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE task_statuses SET ${sets} WHERE id = ?`).run(...Object.values(updates), req.params.id);
  }
  res.json(db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(req.params.id));
});

router.delete('/task-statuses/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM task_statuses WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ── Task-Tag Linking ──

router.post('/tasks/:id/tags', (req, res) => {
  const db = getDb();
  const { tag_id } = req.body || {};
  if (!tag_id) return res.status(400).json({ error: 'tag_id required' });
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'task not found' });
  const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(tag_id);
  if (!tag) return res.status(404).json({ error: 'tag not found' });
  const existing = db.prepare('SELECT id FROM task_tags WHERE task_id = ? AND tag_id = ?').get(req.params.id, tag_id);
  if (existing) return res.status(200).json({ id: existing.id, task_id: req.params.id, tag_id });
  const id = uuidv4();
  db.prepare('INSERT INTO task_tags (id, task_id, tag_id) VALUES (?,?,?)').run(id, req.params.id, tag_id);
  res.status(201).json({ id, task_id: req.params.id, tag_id });
});

router.delete('/tasks/:id/tags/:tagId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?').run(req.params.id, req.params.tagId);
  res.status(204).end();
});

module.exports = router;
```

- [ ] **Step 4: Mount routes in index.js**

In `backend/src/index.js`, add after the existing `app.use('/api', calendarRoutes);`:

```javascript
const taskManagerRoutes = require('./routes/tasks');
app.use('/api', taskManagerRoutes);
```

- [ ] **Step 5: Update GET /tasks/:id to include tags**

In `backend/src/routes/calendar.js`, in the `GET /tasks/:id` handler, after fetching inputs and checklists, add:

```javascript
const tags = db.prepare(
  'SELECT t.* FROM tags t JOIN task_tags tt ON t.id = tt.tag_id WHERE tt.task_id = ?'
).all(req.params.id);
task.tags = tags;
```

- [ ] **Step 6: Restart backend and run tests**

```bash
lsof -ti:3001 | xargs kill 2>/dev/null; sleep 1; PORT=3001 node src/index.js &
sleep 2 && cd /Users/alexnelja/projects/cloudskraal-capex/backend && npm test -- tests/task-tags-api.test.js
```

Expected: All tests pass.

- [ ] **Step 7: Run full backend suite**

```bash
npm test
```

Expected: All pass, no regressions.

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/tasks.js backend/src/index.js backend/src/routes/calendar.js backend/tests/task-tags-api.test.js
git commit -m "feat(tasks): tags, statuses, task-tag linking CRUD routes"
```

---

## Task 4: Frontend Types & API Layer

**Files:**
- Create: `frontend/src/types/taskManager.ts`
- Create: `frontend/src/api/taskManager.ts`
- Modify: `frontend/src/types/calendar.ts`

- [ ] **Step 1: Create types**

Create `frontend/src/types/taskManager.ts`:

```typescript
export interface Tag {
  id: string;
  farm_id: string;
  name: string;
  color: string;
  group: 'enterprise' | 'category' | 'custom';
  sort_order: number;
  created_at: string;
}

export interface TaskStatus {
  id: string;
  farm_id: string;
  name: string;
  color: string;
  category: 'active' | 'done' | 'closed';
  sort_order: number;
  is_default: number;
}

export interface TaskTemplate {
  id: string;
  farm_id: string;
  name: string;
  description: string | null;
  tags: string | null;
  priority: string;
  estimated_minutes: number | null;
  checklist_items: string | null;
  input_defaults: string | null;
  recurrence_rule: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Update Task interface in calendar.ts**

In `frontend/src/types/calendar.ts`, add to the `Task` interface:

```typescript
  status_id: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  blocked_reason: string | null;
  blocked_until: string | null;
  sort_order: number;
  verified_by: string | null;
  verified_at: string | null;
  tags?: Array<{ id: string; name: string; color: string; group: string }>;
```

- [ ] **Step 3: Create API functions**

Create `frontend/src/api/taskManager.ts`:

```typescript
import type { Tag, TaskStatus } from '../types/taskManager';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Tags
export const listTags = (group?: string) =>
  request<Tag[]>(`/tags${group ? `?group=${group}` : ''}`);

export const createTag = (data: { name: string; color?: string; group?: string }) =>
  request<Tag>('/tags', { method: 'POST', body: JSON.stringify(data) });

export const updateTag = (id: string, data: Partial<Tag>) =>
  request<Tag>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteTag = (id: string) =>
  request<void>(`/tags/${id}`, { method: 'DELETE' });

// Task Statuses
export const listStatuses = () =>
  request<TaskStatus[]>('/task-statuses');

export const createStatus = (data: { name: string; color?: string; category: string }) =>
  request<TaskStatus>('/task-statuses', { method: 'POST', body: JSON.stringify(data) });

export const updateStatus = (id: string, data: Partial<TaskStatus>) =>
  request<TaskStatus>(`/task-statuses/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteStatus = (id: string) =>
  request<void>(`/task-statuses/${id}`, { method: 'DELETE' });

// Task-Tag linking
export const addTagToTask = (taskId: string, tagId: string) =>
  request<{ id: string; task_id: string; tag_id: string }>(
    `/tasks/${taskId}/tags`, { method: 'POST', body: JSON.stringify({ tag_id: tagId }) }
  );

export const removeTagFromTask = (taskId: string, tagId: string) =>
  request<void>(`/tasks/${taskId}/tags/${tagId}`, { method: 'DELETE' });
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend && npx tsc -b --noEmit 2>&1 | grep -v "WeatherForecastPanel\|FarmMapPage.test\|QuickAddFAB\|terra-draw\|AnnotateTool"
```

Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/taskManager.ts frontend/src/api/taskManager.ts frontend/src/types/calendar.ts
git commit -m "feat(tasks): frontend types + API layer for tags, statuses, task-tags"
```

---

## Task 5: Navigation & Routing

**Files:**
- Create: `frontend/src/pages/TaskManagerPage.tsx` (stub)
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create stub page**

Create `frontend/src/pages/TaskManagerPage.tsx`:

```typescript
export default function TaskManagerPage() {
  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-serif text-stone-900">Tasks</h1>
        <p className="text-sm text-stone-500 mt-1">Task manager coming soon.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add nav item to Sidebar.tsx**

In `frontend/src/components/Sidebar.tsx`, add to the first nav group after Calendar:

```typescript
{ to: '/tasks', icon: CheckSquare, label: 'Tasks' },
```

Import `CheckSquare` from `lucide-react` (or `@phosphor-icons/react` if that's what the sidebar uses — check the existing imports).

- [ ] **Step 3: Add route to App.tsx**

In `frontend/src/App.tsx`, add import:
```typescript
import TaskManagerPage from './pages/TaskManagerPage';
```

Add route:
```tsx
<Route path="/tasks" element={<TaskManagerPage />} />
```

- [ ] **Step 4: Verify in browser**

Navigate to `http://localhost:5175/tasks` — should see "Tasks" heading.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TaskManagerPage.tsx frontend/src/components/Sidebar.tsx frontend/src/App.tsx
git commit -m "feat(tasks): add /tasks route and nav item"
```

---

## Task 6: Today View — Task List Component

**Files:**
- Create: `frontend/src/components/tasks/TaskRow.tsx`
- Create: `frontend/src/components/tasks/TaskRow.test.tsx`
- Create: `frontend/src/components/tasks/DailyProgress.tsx`
- Create: `frontend/src/components/tasks/DailyProgress.test.tsx`
- Create: `frontend/src/components/tasks/TodayView.tsx`
- Create: `frontend/src/components/tasks/TodayView.test.tsx`
- Modify: `frontend/src/pages/TaskManagerPage.tsx`

This task builds the core Today view with task rows (title, status pill, priority badge, tags, due time, completion interaction) and a daily progress bar. Tests first, then implementation.

- [ ] **Step 1: Write TaskRow test**

Create `frontend/src/components/tasks/TaskRow.test.tsx` with tests for:
- Renders title and priority badge
- Renders tag pills with colors
- Clicking checkbox calls onComplete
- Shows field name when linked
- Shows overdue styling when past due

- [ ] **Step 2: Implement TaskRow**

Create `frontend/src/components/tasks/TaskRow.tsx`:
- Checkbox (left) with haptic + strikethrough animation on complete
- Title + tags row
- Priority badge (colored dot)
- Due time (right-aligned)
- Field name pill (if field_id linked)
- motion.div for enter/exit animations

- [ ] **Step 3: Run TaskRow tests**

```bash
npx vitest run src/components/tasks/TaskRow.test.tsx
```

- [ ] **Step 4: Write DailyProgress test**

Create `frontend/src/components/tasks/DailyProgress.test.tsx`:
- Shows "0 of 5" text
- Progress bar width matches completion ratio
- Shows "All done" when 100%

- [ ] **Step 5: Implement DailyProgress**

Create `frontend/src/components/tasks/DailyProgress.tsx`:
- Horizontal bar with fill animation (motion.div)
- Label: "X of Y done"
- Golden gradient fill at 100%

- [ ] **Step 6: Write TodayView test**

Create `frontend/src/components/tasks/TodayView.test.tsx`:
- Renders task list
- Groups tasks (overdue, today, upcoming)
- Shows empty state when no tasks

- [ ] **Step 7: Implement TodayView**

Create `frontend/src/components/tasks/TodayView.tsx`:
- Fetches tasks with `due_date = today` and overdue
- Groups into: Overdue / Today / Tomorrow
- Renders TaskRow per task
- DailyProgress at bottom
- Enterprise/category tag filter pills at top

- [ ] **Step 8: Wire into TaskManagerPage**

Update `frontend/src/pages/TaskManagerPage.tsx` to import and render TodayView with data fetching.

- [ ] **Step 9: Run all frontend tests**

```bash
npm test
```

Expected: All pass.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/tasks/ frontend/src/pages/TaskManagerPage.tsx
git commit -m "feat(tasks): Today view with TaskRow, DailyProgress, and tag filters"
```

---

## Task 7: Task Creation Form

**Files:**
- Create: `frontend/src/components/tasks/TaskCreateForm.tsx`
- Create: `frontend/src/components/tasks/TaskCreateForm.test.tsx`
- Modify: `frontend/src/pages/TaskManagerPage.tsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/components/tasks/TaskCreateForm.test.tsx`:
- Renders title input and save button
- Save button disabled when title empty
- Calls onCreate with form data on submit
- Shows tag multi-select with colored pills
- Shows status dropdown populated from custom statuses
- Shows priority selector
- Shows field dropdown (searchable)
- Shows due date picker

- [ ] **Step 2: Implement TaskCreateForm**

Create `frontend/src/components/tasks/TaskCreateForm.tsx`:
- Full expanded form (the 20% case from spec)
- Title, description textarea
- Status dropdown (from listStatuses API)
- Priority selector (low/medium/high/urgent pills)
- Tags multi-select (from listTags API, colored pills)
- Field selector (searchable dropdown)
- Due date input
- Assignee text input
- Estimated duration (minutes)
- Save / Cancel buttons
- FluidDialog wrapper

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/components/tasks/TaskCreateForm.test.tsx
```

- [ ] **Step 4: Wire "+" button into TaskManagerPage**

Add a floating "+" button that opens the TaskCreateForm in a FluidDialog.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend && npm test
cd ../backend && npm test
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/tasks/TaskCreateForm.tsx frontend/src/components/tasks/TaskCreateForm.test.tsx frontend/src/pages/TaskManagerPage.tsx
git commit -m "feat(tasks): task creation form with tags, custom statuses, field linking"
```

---

## Task 8: Final Verification & Handoff

- [ ] **Step 1: TypeScript check**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend && npx tsc -b --noEmit
```

- [ ] **Step 2: Full frontend tests**

```bash
npm test
```

- [ ] **Step 3: Full backend tests**

```bash
cd ../backend && npm test
```

- [ ] **Step 4: Manual smoke test**

1. Navigate to `/tasks` — Today view loads
2. Click "+" — creation form opens
3. Fill title, select tags, set priority, save
4. New task appears in Today view
5. Click checkbox — task completes with animation
6. Progress bar updates

- [ ] **Step 5: Commit any fixes**

- [ ] **Step 6: Create handoff document**

```bash
git log --oneline -10  # capture commit hashes for handoff
```

---

## Phase 1 Deliverables Summary

| What | Status |
|------|--------|
| tags, task_tags, task_statuses, task_templates tables | |
| Default tags (7 categories + 4 enterprises) seeded | |
| Default statuses (6) seeded | |
| Safe status_id migration with backfill | |
| Tags CRUD API (GET/POST/PATCH/DELETE) | |
| Statuses CRUD API (GET/POST/PATCH/DELETE) | |
| Task-tag linking API (POST/DELETE) | |
| Frontend types for Tag, TaskStatus, TaskTemplate | |
| Frontend API layer for tags/statuses | |
| /tasks route + nav item | |
| Today view with grouped task list | |
| TaskRow with completion animation | |
| DailyProgress bar | |
| Task creation form (expanded) | |
| Migration safety tests | |
| API integration tests | |
| Component unit tests | |

**Phase 2 (next plan):** Quick input bar with NLP, Board view with dnd-kit, List view, drag-to-reorder, tag management UI, milestone celebrations.
