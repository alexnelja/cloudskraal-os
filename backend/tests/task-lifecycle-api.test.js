/**
 * Spec 4.1 — task lifecycle API (integration; server on :3001).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'capex.db');
const BASE = 'http://localhost:3001/api';
async function api(p, o = {}) {
  const res = await fetch(`${BASE}${p}`, { headers: { 'Content-Type': 'application/json' }, ...o });
  return { status: res.status, data: await res.json() };
}
const SENT = '__test_lifecycle_task__';
let taskId, fieldId;

beforeAll(async () => {
  const db = new Database(DB_PATH, { readonly: true });
  fieldId = db.prepare("SELECT id FROM fields WHERE enterprise='rooibos' AND area_ha > 0 LIMIT 1").get()?.id;
  db.close();
  const { data } = await api('/tasks', {
    method: 'POST', body: JSON.stringify({ title: SENT, field_id: fieldId }),
  });
  taskId = data.id;
});
afterAll(() => {
  const db = new Database(DB_PATH);
  for (const t of db.prepare('SELECT id FROM tasks WHERE title = ?').all(SENT)) {
    db.prepare('DELETE FROM task_events WHERE task_id = ?').run(t.id);
    db.prepare('DELETE FROM inventory_transactions WHERE task_id = ?').run(t.id);
    db.prepare('DELETE FROM time_entries WHERE task_id = ?').run(t.id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(t.id);
  }
  db.close();
});

describe('task lifecycle API', () => {
  it('walks scheduled → in_progress → completed → verified with an event trail', async () => {
    let r = await api(`/tasks/${taskId}/transition`, {
      method: 'POST', body: JSON.stringify({ to_state: 'in_progress', by: 'Alex' }),
    });
    expect(r.status).toBe(200);
    expect(r.data.task.state).toBe('in_progress');

    r = await api(`/tasks/${taskId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ to_state: 'completed', actual_duration_hrs: 2 }),
    });
    expect(r.data.task.state).toBe('completed');

    r = await api(`/tasks/${taskId}/transition`, {
      method: 'POST', body: JSON.stringify({ to_state: 'verified', by: 'Alex' }),
    });
    expect(r.status).toBe(200);
    expect(r.data.task.state).toBe('verified');

    const ev = await api(`/tasks/${taskId}/events`);
    expect(ev.data.map(e => e.event_type)).toEqual(['started', 'completed', 'verified']);
  });
  it('double verify → 409 already_verified', async () => {
    const r = await api(`/tasks/${taskId}/transition`, {
      method: 'POST', body: JSON.stringify({ to_state: 'verified', by: 'Alex' }),
    });
    expect(r.status).toBe(409);
    expect(r.data.error).toBe('already_verified');
  });
  it('illegal jump → 409', async () => {
    const { data: created } = await api('/tasks', {
      method: 'POST', body: JSON.stringify({ title: SENT, field_id: fieldId }),
    });
    const r = await api(`/tasks/${created.id}/transition`, {
      method: 'POST', body: JSON.stringify({ to_state: 'verified' }),
    });
    expect(r.status).toBe(409);
    expect(r.data.error).toBe('illegal_transition');
  });
});
