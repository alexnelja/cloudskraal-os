/**
 * Spec 2f.1 — Livestock COP inputs API (integration; requires server on :3001).
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
  const res = await fetch(`${BASE}${p}`, {
    headers: { 'Content-Type': 'application/json' }, ...o,
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

const SENTINEL = '__test_cop_inputs_api__';
let groupId;

beforeAll(async () => {
  const { status, data } = await api('/livestock/groups', {
    method: 'POST',
    body: JSON.stringify({ name: SENTINEL, species: 'sheep', head_count: 100 }),
  });
  expect(status).toBe(201);
  groupId = data.id;
});

afterAll(() => {
  const db = new Database(DB_PATH);
  const groups = db.prepare('SELECT id FROM livestock_groups WHERE name = ?').all(SENTINEL);
  for (const g of groups) {
    db.prepare('DELETE FROM flock_cop_inputs WHERE group_id = ?').run(g.id);
    db.prepare('DELETE FROM livestock_groups WHERE id = ?').run(g.id);
  }
  db.close();
});

describe('Livestock COP inputs API', () => {
  it('POST creates a row and returns 201', async () => {
    const { status, data } = await api(`/livestock/groups/${groupId}/cop-inputs`, {
      method: 'POST',
      body: JSON.stringify({
        year: 2025, ewes_mated: 100, weaning_pct: 125,
        feed_cost: 25000, labour_cost: 17000, animal_health_cost: 17000,
        wool_income: 159000, meat_income: 143000,
      }),
    });
    expect(status).toBe(201);
    expect(data.group_id).toBe(groupId);
    expect(data.year).toBe(2025);
    expect(data.feed_cost).toBe(25000);
    expect(data.source).toBe('actual');
  });

  it('GET /groups/:id/cop-inputs returns the row', async () => {
    const { status, data } = await api(`/livestock/groups/${groupId}/cop-inputs`);
    expect(status).toBe(200);
    expect(data.some(r => r.year === 2025)).toBe(true);
  });

  it('POST duplicate (group, year) → 409', async () => {
    const { status } = await api(`/livestock/groups/${groupId}/cop-inputs`, {
      method: 'POST',
      body: JSON.stringify({ year: 2025, feed_cost: 1 }),
    });
    expect(status).toBe(409);
  });

  it('POST missing year → 400', async () => {
    const { status } = await api(`/livestock/groups/${groupId}/cop-inputs`, {
      method: 'POST',
      body: JSON.stringify({ feed_cost: 1 }),
    });
    expect(status).toBe(400);
  });

  it('POST non-numeric cost → 400', async () => {
    const { status } = await api(`/livestock/groups/${groupId}/cop-inputs`, {
      method: 'POST',
      body: JSON.stringify({ year: 2099, feed_cost: 'lots' }),
    });
    expect(status).toBe(400);
  });

  it('POST to unknown group → 404', async () => {
    const { status } = await api('/livestock/groups/does-not-exist/cop-inputs', {
      method: 'POST',
      body: JSON.stringify({ year: 2025 }),
    });
    expect(status).toBe(404);
  });

  it('PATCH updates a field', async () => {
    const list = (await api(`/livestock/groups/${groupId}/cop-inputs`)).data;
    const row = list.find(r => r.year === 2025);
    const { status, data } = await api(`/livestock/cop-inputs/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ feed_cost: 30000 }),
    });
    expect(status).toBe(200);
    expect(data.feed_cost).toBe(30000);
  });

  it('GET /livestock/cop-inputs?year= filters', async () => {
    const { status, data } = await api('/livestock/cop-inputs?year=2025');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.every(r => r.year === 2025)).toBe(true);
  });
});
