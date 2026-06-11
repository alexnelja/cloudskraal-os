/**
 * Spec 3.2 — task suggestions API (integration; server on :3001).
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
const SENT = '__test_template_task__';
let fieldId;

beforeAll(() => {
  const db = new Database(DB_PATH, { readonly: true });
  fieldId = db.prepare("SELECT id FROM fields WHERE enterprise='rooibos' AND area_ha > 0 LIMIT 1").get()?.id;
  db.close();
});
afterAll(() => {
  const db = new Database(DB_PATH);
  db.prepare('DELETE FROM tasks WHERE title = ?').run(SENT);
  db.close();
});

describe('task-suggestions API', () => {
  it('GET /fields/:id/task-suggestions returns rooibos ops for a rooibos field', async () => {
    const { status, data } = await api(`/fields/${fieldId}/task-suggestions`);
    expect(status).toBe(200);
    expect(data.usage).toBe('rooibos');
    expect(data.suggestions.length).toBeGreaterThan(0);
    const ops = data.suggestions.map(s => s.op_type);
    expect(ops).toContain('harvest');
    expect(data.suggestions[0]).toHaveProperty('estimated_cost_zar');
  });
  it('GET /task-templates filters by usage', async () => {
    const { status, data } = await api('/task-templates?usage=fallow');
    expect(status).toBe(200);
    expect(data.every(t => t.usage === 'fallow')).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
  it('POST /tasks with template_id freezes estimated_cost_zar', async () => {
    const { data: sugg } = await api(`/fields/${fieldId}/task-suggestions`);
    const tpl = sugg.suggestions[0];
    const { status, data } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: SENT, field_id: fieldId, template_id: tpl.template_id }),
    });
    expect(status).toBe(201);
    expect(data.template_id).toBe(tpl.template_id);
    expect(data.estimated_cost_zar).toBe(tpl.estimated_cost_zar);
  });
  it('404s suggestions for an unknown field', async () => {
    const { status } = await api('/fields/nope/task-suggestions');
    expect(status).toBe(404);
  });
});
