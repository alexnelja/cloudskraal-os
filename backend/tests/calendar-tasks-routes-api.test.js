/**
 * Characterization test for the calendar.js route split (v1.0.0 release gate).
 *
 * Locks the observable behaviour of every route currently living in
 * routes/calendar.js — calendar EVENTS (+summary) and TASK crud (+inputs,
 * +checklists) — so the events-vs-tasks file split is provably behaviour
 * preserving. Several of these endpoints had zero coverage before this file.
 */
import { describe, it, expect, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'capex.db');
const BASE = 'http://localhost:3001/api';
const SENTINEL = '__CAL_TASK_SPLIT_TEST__';

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
  const ids = db.prepare(`SELECT id FROM tasks WHERE title LIKE '${SENTINEL}%'`).all().map((r) => r.id);
  for (const id of ids) {
    db.prepare('DELETE FROM task_inputs WHERE task_id = ?').run(id);
    db.prepare('DELETE FROM task_checklists WHERE task_id = ?').run(id);
  }
  db.prepare(`DELETE FROM tasks WHERE title LIKE '${SENTINEL}%'`).run();
  db.prepare(`DELETE FROM calendar_events WHERE title LIKE '${SENTINEL}%'`).run();
  db.close();
});

describe('calendar EVENTS routes', () => {
  it('POST creates an event, GET lists it, month + enterprise filters work', async () => {
    const { status, data: ev } = await api('/calendar/events', {
      method: 'POST',
      body: JSON.stringify({
        title: `${SENTINEL} planting day`,
        enterprise: 'rooibos',
        start_date: '2026-08-15',
        notes: 'characterization',
      }),
    });
    expect(status).toBe(201);
    expect(ev.id).toBeTruthy();
    expect(ev.title).toBe(`${SENTINEL} planting day`);
    expect(ev.all_day).toBe(1); // defaults to all-day

    const { data: byMonth } = await api('/calendar/events?month=2026-08');
    expect(byMonth.some((e) => e.id === ev.id)).toBe(true);

    const { data: otherMonth } = await api('/calendar/events?month=2026-01');
    expect(otherMonth.some((e) => e.id === ev.id)).toBe(false);

    const { data: byEnt } = await api('/calendar/events?enterprise=rooibos');
    expect(byEnt.every((e) => e.enterprise === 'rooibos')).toBe(true);
  });

  it('POST requires title and start_date', async () => {
    const { status } = await api('/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ enterprise: 'rooibos' }),
    });
    expect(status).toBe(400);
  });

  it('PATCH updates fields; DELETE removes the event', async () => {
    const { data: ev } = await api('/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ title: `${SENTINEL} edit me`, start_date: '2026-09-01' }),
    });

    const { data: patched } = await api(`/calendar/events/${ev.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'updated', color: '#abc' }),
    });
    expect(patched.notes).toBe('updated');
    expect(patched.color).toBe('#abc');

    const { status: delStatus } = await api(`/calendar/events/${ev.id}`, { method: 'DELETE' });
    expect(delStatus).toBe(204);

    const { status: patch404 } = await api(`/calendar/events/${ev.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'x' }),
    });
    expect(patch404).toBe(404);
  });

  it('GET /calendar/summary returns events and tasks for the month', async () => {
    await api('/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ title: `${SENTINEL} summary ev`, start_date: '2026-10-10' }),
    });
    await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: `${SENTINEL} summary task`, due_date: '2026-10-12' }),
    });

    const { status, data } = await api('/calendar/summary?month=2026-10');
    expect(status).toBe(200);
    expect(Array.isArray(data.events)).toBe(true);
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(data.events.some((e) => e.title === `${SENTINEL} summary ev`)).toBe(true);
    expect(data.tasks.some((t) => t.title === `${SENTINEL} summary task`)).toBe(true);

    const { status: missing } = await api('/calendar/summary');
    expect(missing).toBe(400);
  });
});

describe('TASK crud routes', () => {
  it('POST creates, GET :id hydrates inputs/checklists/tags, PATCH updates', async () => {
    const { status, data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: `${SENTINEL} spray block A`,
        enterprise: 'rooibos',
        priority: 'high',
        due_date: '2026-08-20',
      }),
    });
    expect(status).toBe(201);
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('high');

    const { data: full } = await api(`/tasks/${task.id}`);
    expect(full.id).toBe(task.id);
    expect(Array.isArray(full.inputs)).toBe(true);
    expect(Array.isArray(full.checklists)).toBe(true);
    expect(Array.isArray(full.tags)).toBe(true);

    const { data: patched } = await api(`/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ priority: 'low', notes: 'rescheduled' }),
    });
    expect(patched.priority).toBe('low');
    expect(patched.notes).toBe('rescheduled');
  });

  it('POST requires title; GET :id 404 for unknown', async () => {
    const { status } = await api('/tasks', { method: 'POST', body: JSON.stringify({ enterprise: 'x' }) });
    expect(status).toBe(400);
    const { status: nf } = await api('/tasks/does-not-exist');
    expect(nf).toBe(404);
  });

  it('GET /tasks filters by enterprise; overdue + upcoming endpoints resolve', async () => {
    const { data: t } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: `${SENTINEL} overdue one`, enterprise: 'lupines', due_date: '2020-01-01' }),
    });

    const { data: byEnt } = await api('/tasks?enterprise=lupines');
    expect(byEnt.every((row) => row.enterprise === 'lupines')).toBe(true);

    const { status: ov, data: overdue } = await api('/tasks/overdue');
    expect(ov).toBe(200);
    expect(overdue.some((row) => row.id === t.id)).toBe(true);

    const { status: up } = await api('/tasks/upcoming?days=7');
    expect(up).toBe(200);
  });

  it('inputs: add, surface on GET, delete', async () => {
    const { data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: `${SENTINEL} input task` }),
    });
    const { status, data: input } = await api(`/tasks/${task.id}/inputs`, {
      method: 'POST',
      body: JSON.stringify({ product_name: 'Roundup', category: 'herbicide', total_cost: 123.45 }),
    });
    expect(status).toBe(201);
    expect(input.product_name).toBe('Roundup');

    const { data: full } = await api(`/tasks/${task.id}`);
    expect(full.inputs.some((i) => i.id === input.id)).toBe(true);

    const { status: del } = await api(`/task-inputs/${input.id}`, { method: 'DELETE' });
    expect(del).toBe(204);

    const { status: missingProduct } = await api(`/tasks/${task.id}/inputs`, {
      method: 'POST',
      body: JSON.stringify({ category: 'herbicide' }),
    });
    expect(missingProduct).toBe(400);
  });

  it('checklists: add, patch checked, delete', async () => {
    const { data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: `${SENTINEL} checklist task` }),
    });
    const { status, data: item } = await api(`/tasks/${task.id}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ item: 'Calibrate sprayer', sort_order: 1 }),
    });
    expect(status).toBe(201);
    expect(item.checked).toBe(0);

    const { data: checked } = await api(`/task-checklists/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ checked: 1 }),
    });
    expect(checked.checked).toBe(1);

    const { status: del } = await api(`/task-checklists/${item.id}`, { method: 'DELETE' });
    expect(del).toBe(204);
  });

  it('complete enforces dependency, sets completed; uncomplete reverts', async () => {
    const { data: dep } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: `${SENTINEL} dependency` }),
    });
    const { data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: `${SENTINEL} blocked`, depends_on_task_id: dep.id }),
    });

    // Dependency not complete → 400
    const { status: blocked } = await api(`/tasks/${task.id}/complete`, { method: 'POST' });
    expect(blocked).toBe(400);

    // Complete the dependency, then the task
    await api(`/tasks/${dep.id}/complete`, { method: 'POST' });
    const { status, data: done } = await api(`/tasks/${task.id}/complete`, { method: 'POST' });
    expect(status).toBe(200);
    expect(done.status).toBe('completed');
    expect(Array.isArray(done.costs_logged)).toBe(true);

    const { data: reverted } = await api(`/tasks/${task.id}/uncomplete`, { method: 'POST' });
    expect(reverted.status).toBe('pending');
    expect(reverted.completed_date).toBeNull();
  });

  it('DELETE removes a task', async () => {
    const { data: task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: `${SENTINEL} delete me` }),
    });
    const { status } = await api(`/tasks/${task.id}`, { method: 'DELETE' });
    expect(status).toBe(204);
    const { status: nf } = await api(`/tasks/${task.id}`);
    expect(nf).toBe(404);
  });
});
