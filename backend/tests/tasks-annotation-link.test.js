import { describe, it, expect, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'capex.db');
const BASE = 'http://localhost:3001/api';
const SENTINEL = '__TASK_LINK_TEST__';

async function api(p, options = {}) {
  const res = await fetch(`${BASE}${p}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

afterAll(() => {
  const db = new Database(DB_PATH);
  db.prepare(`DELETE FROM tasks WHERE title LIKE '${SENTINEL}%'`).run();
  db.prepare(`DELETE FROM annotations WHERE title LIKE '${SENTINEL}%'`).run();
  db.close();
});

describe('tasks ↔ annotation link', () => {
  it('POST task with annotation_id persists and GET filter returns it', async () => {
    // Create an annotation to link to
    const { data: ann } = await api('/annotations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'pin',
        title: `${SENTINEL} pump`,
        category: 'pump',
        geometry: { type: 'Point', coordinates: [19.0, -31.3] },
      }),
    });
    expect(ann.id).toBeTruthy();

    // Create a task linked to it
    const { status, data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: `${SENTINEL} service pump`,
        annotation_id: ann.id,
        priority: 'high',
      }),
    });
    expect(status).toBe(201);
    expect(task.annotation_id).toBe(ann.id);

    // GET filter finds it
    const { data: list } = await api(`/tasks?annotation_id=${ann.id}`);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.every((t) => t.annotation_id === ann.id)).toBe(true);
  });

  it('ON DELETE SET NULL clears annotation_id when annotation is deleted', async () => {
    const { data: ann } = await api('/annotations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'pin',
        title: `${SENTINEL} gate2`,
        category: 'gate',
        geometry: { type: 'Point', coordinates: [19.1, -31.3] },
      }),
    });
    const { data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: `${SENTINEL} close gate`,
        annotation_id: ann.id,
      }),
    });
    await api(`/annotations/${ann.id}`, { method: 'DELETE' });
    const { data: fetched } = await api(`/tasks/${task.id}`);
    expect(fetched.annotation_id).toBeNull();
  });

  it('PATCH can change annotation_id', async () => {
    const { data: ann1 } = await api('/annotations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'pin',
        title: `${SENTINEL} a1`,
        geometry: { type: 'Point', coordinates: [19, -31] },
      }),
    });
    const { data: ann2 } = await api('/annotations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'pin',
        title: `${SENTINEL} a2`,
        geometry: { type: 'Point', coordinates: [19.01, -31] },
      }),
    });
    const { data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: `${SENTINEL} reassign`,
        annotation_id: ann1.id,
      }),
    });
    const { data: updated } = await api(`/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ annotation_id: ann2.id }),
    });
    expect(updated.annotation_id).toBe(ann2.id);
  });
});
