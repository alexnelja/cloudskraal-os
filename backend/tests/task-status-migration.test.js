import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { initTaskManagerSchema, seedDefaultTags, seedDefaultStatuses } from '../src/db/schema-tasks.js';
import { migrateTaskStatusId } from '../src/db/migrate-task-status-id.js';

function seedDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);
  initCalendarSchema(db);
  initTaskManagerSchema(db);
  seedDefaultTags(db);
  seedDefaultStatuses(db);
  return db;
}

describe('task status migration', () => {
  it('tasks table has status_id column after migration', () => {
    const db = seedDb();
    migrateTaskStatusId(db);
    const cols = db.prepare('PRAGMA table_info(tasks)').all().map(c => c.name);
    expect(cols).toContain('status_id');
    db.close();
  });

  it('tasks table has new task manager columns', () => {
    const db = seedDb();
    migrateTaskStatusId(db);
    const cols = db.prepare('PRAGMA table_info(tasks)').all().map(c => c.name);
    expect(cols).toContain('estimated_minutes');
    expect(cols).toContain('actual_minutes');
    expect(cols).toContain('blocked_reason');
    expect(cols).toContain('blocked_until');
    expect(cols).toContain('sort_order');
    expect(cols).toContain('verified_by');
    expect(cols).toContain('verified_at');
    db.close();
  });

  it('task_statuses has 6 default statuses', () => {
    const db = seedDb();
    migrateTaskStatusId(db);
    const count = db.prepare('SELECT COUNT(*) as c FROM task_statuses').get();
    expect(count.c).toBeGreaterThanOrEqual(6);
    db.close();
  });

  it('default statuses include Todo, Blocked, Verified', () => {
    const db = seedDb();
    migrateTaskStatusId(db);
    const names = db.prepare('SELECT name FROM task_statuses ORDER BY sort_order').all().map(r => r.name);
    expect(names).toContain('Todo');
    expect(names).toContain('Blocked');
    expect(names).toContain('Verified');
    db.close();
  });

  it('backfills status_id from existing status text', () => {
    const db = seedDb();

    // Insert tasks with old-style text statuses before migration
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO tasks (id, title, status, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run('t1', 'Pending task', 'pending', 'manual', now, now);
    db.prepare(
      "INSERT INTO tasks (id, title, status, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run('t2', 'In progress task', 'in_progress', 'manual', now, now);
    db.prepare(
      "INSERT INTO tasks (id, title, status, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run('t3', 'Completed task', 'completed', 'manual', now, now);

    migrateTaskStatusId(db);

    // No orphaned tasks
    const orphaned = db.prepare(
      'SELECT COUNT(*) as c FROM tasks WHERE status IS NOT NULL AND status_id IS NULL'
    ).get();
    expect(orphaned.c).toBe(0);

    // Verify correct mapping
    const t1 = db.prepare('SELECT status_id FROM tasks WHERE id = ?').get('t1');
    const todoStatus = db.prepare("SELECT id FROM task_statuses WHERE name = 'Todo'").get();
    expect(t1.status_id).toBe(todoStatus.id);

    const t2 = db.prepare('SELECT status_id FROM tasks WHERE id = ?').get('t2');
    const inProgressStatus = db.prepare("SELECT id FROM task_statuses WHERE name = 'In Progress'").get();
    expect(t2.status_id).toBe(inProgressStatus.id);

    db.close();
  });

  it('is idempotent — running twice does not error', () => {
    const db = seedDb();
    migrateTaskStatusId(db);
    migrateTaskStatusId(db);
    const cols = db.prepare('PRAGMA table_info(tasks)').all().map(c => c.name);
    expect(cols).toContain('status_id');
    expect(cols).toContain('estimated_minutes');
    db.close();
  });
});
