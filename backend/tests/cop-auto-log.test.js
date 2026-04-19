import { describe, it, expect, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'capex.db');
const BASE = 'http://localhost:3001/api';
const SENTINEL = '__COP_AUTO_LOG_TEST__';

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
  db.prepare(`DELETE FROM task_inputs WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE '${SENTINEL}%')`).run();
  db.prepare(`DELETE FROM tasks WHERE title LIKE '${SENTINEL}%'`).run();
  db.close();
});

describe('COP auto-log on task completion', () => {
  it('returns costs_logged when completing a task with field_id and inputs', async () => {
    // Get a field to use
    const { data: fields } = await api('/fields');
    const field = fields[0];
    if (!field) throw new Error('No fields in database — need at least one for this test');

    // Create a task with field_id
    const { data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: `${SENTINEL} spray field`,
        field_id: field.id,
        priority: 'medium',
      }),
    });
    expect(task.id).toBeTruthy();

    // Add an input with cost
    const { data: input } = await api(`/tasks/${task.id}/inputs`, {
      method: 'POST',
      body: JSON.stringify({
        product_name: 'Roundup',
        category: 'herbicide',
        total_cost: 1250.00,
        cost_per_unit: 250,
        total_applied: 5,
        total_unit: 'litres',
      }),
    });
    expect(input.id).toBeTruthy();

    // Complete the task
    const { data: completed } = await api(`/tasks/${task.id}/complete`, { method: 'POST' });
    expect(completed.status).toBe('completed');
    expect(completed.costs_logged).toBeDefined();
    expect(completed.costs_logged.length).toBe(1);
    expect(completed.costs_logged[0].product_name).toBe('Roundup');
    expect(completed.costs_logged[0].total_cost).toBe(1250);
  });

  it('returns empty costs_logged when task has no inputs', async () => {
    const { data: fields } = await api('/fields');
    const field = fields[0];

    const { data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: `${SENTINEL} no inputs`,
        field_id: field.id,
      }),
    });

    const { data: completed } = await api(`/tasks/${task.id}/complete`, { method: 'POST' });
    expect(completed.costs_logged).toBeDefined();
    expect(completed.costs_logged.length).toBe(0);
  });

  it('returns empty costs_logged when task has no field_id', async () => {
    const { data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: `${SENTINEL} no field`,
      }),
    });

    // Add an input with cost (but task has no field)
    await api(`/tasks/${task.id}/inputs`, {
      method: 'POST',
      body: JSON.stringify({
        product_name: 'Fertilizer',
        total_cost: 500,
      }),
    });

    const { data: completed } = await api(`/tasks/${task.id}/complete`, { method: 'POST' });
    expect(completed.costs_logged).toBeDefined();
    expect(completed.costs_logged.length).toBe(0);
  });

  it('uncomplete reverts a completed task to pending', async () => {
    const { data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: `${SENTINEL} undo test`,
      }),
    });

    // Complete it
    const { data: completed } = await api(`/tasks/${task.id}/complete`, { method: 'POST' });
    expect(completed.status).toBe('completed');

    // Uncomplete it
    const { data: reverted } = await api(`/tasks/${task.id}/uncomplete`, { method: 'POST' });
    expect(reverted.status).toBe('pending');
    expect(reverted.completed_date).toBeNull();
  });

  it('uncomplete returns 400 if task is not completed', async () => {
    const { data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: `${SENTINEL} not completed`,
      }),
    });

    const { status } = await api(`/tasks/${task.id}/uncomplete`, { method: 'POST' });
    expect(status).toBe(400);
  });
});
