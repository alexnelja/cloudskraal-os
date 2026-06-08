/**
 * Spec 2f.2 API — grazing-events, feeding-events, flock cost-of-production.
 * Integration; requires server on :3001.
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
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

const SENTINEL = '__test_2f2_api__';
let groupId, fieldId, seededFlockId;

beforeAll(async () => {
  groupId = (await api('/livestock/groups', {
    method: 'POST', body: JSON.stringify({ name: SENTINEL, species: 'sheep', head_count: 100 }),
  })).data.id;

  const db = new Database(DB_PATH, { readonly: true });
  fieldId = db.prepare("SELECT id FROM fields WHERE enterprise NOT IN ('farm_boundary') LIMIT 1").get()?.id;
  seededFlockId = db.prepare("SELECT id FROM livestock_groups WHERE name='Breeding Ewes 2025'").get()?.id;
  db.close();
});

afterAll(() => {
  const db = new Database(DB_PATH);
  for (const g of db.prepare('SELECT id FROM livestock_groups WHERE name = ?').all(SENTINEL)) {
    db.prepare('DELETE FROM grazing_events WHERE group_id = ?').run(g.id);
    db.prepare('DELETE FROM feeding_events WHERE group_id = ?').run(g.id);
    db.prepare('DELETE FROM flock_cop_inputs WHERE group_id = ?').run(g.id);
    db.prepare('DELETE FROM livestock_groups WHERE id = ?').run(g.id);
  }
  db.close();
});

describe('grazing-events API', () => {
  let eventId;
  it('POST creates a grazing event', async () => {
    const { status, data } = await api('/livestock/grazing-events', {
      method: 'POST',
      body: JSON.stringify({ group_id: groupId, field_id: fieldId, start_date: '2025-01-01', end_date: '2025-06-30', allocation_fraction: 0.5 }),
    });
    expect(status).toBe(201);
    expect(data.allocation_fraction).toBe(0.5);
    eventId = data.id;
  });
  it('POST rejects allocation_fraction > 1', async () => {
    const { status } = await api('/livestock/grazing-events', {
      method: 'POST', body: JSON.stringify({ group_id: groupId, start_date: '2025-01-01', allocation_fraction: 1.5 }),
    });
    expect(status).toBe(400);
  });
  it('POST to unknown group → 404', async () => {
    const { status } = await api('/livestock/grazing-events', {
      method: 'POST', body: JSON.stringify({ group_id: 'nope', start_date: '2025-01-01', allocation_fraction: 0.5 }),
    });
    expect(status).toBe(404);
  });
  it('GET filters by group', async () => {
    const { status, data } = await api(`/livestock/grazing-events?group_id=${groupId}`);
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThan(0);
  });
  it('PATCH then DELETE', async () => {
    const patch = await api(`/livestock/grazing-events/${eventId}`, {
      method: 'PATCH', body: JSON.stringify({ allocation_fraction: 0.3 }),
    });
    expect(patch.data.allocation_fraction).toBe(0.3);
    const del = await api(`/livestock/grazing-events/${eventId}`, { method: 'DELETE' });
    expect(del.status).toBe(204);
  });
});

describe('feeding-events API', () => {
  it('POST purchased creates an event', async () => {
    const { status, data } = await api('/livestock/feeding-events', {
      method: 'POST',
      body: JSON.stringify({ group_id: groupId, date: '2025-06-01', source_type: 'purchased', product: 'lucerne', quantity_kg: 1000, unit_cost_zar: 4 }),
    });
    expect(status).toBe(201);
    expect(data.source_type).toBe('purchased');
  });
  it('POST internal without source field → 400', async () => {
    const { status } = await api('/livestock/feeding-events', {
      method: 'POST', body: JSON.stringify({ group_id: groupId, date: '2025-06-01', source_type: 'internal', quantity_kg: 100 }),
    });
    expect(status).toBe(400);
  });
  it('POST invalid source_type → 400', async () => {
    const { status } = await api('/livestock/feeding-events', {
      method: 'POST', body: JSON.stringify({ group_id: groupId, date: '2025-06-01', source_type: 'stolen', quantity_kg: 100 }),
    });
    expect(status).toBe(400);
  });
});

describe('flock cost-of-production API', () => {
  it('returns a report for a seeded flock/year', async () => {
    const { status, data } = await api(`/livestock/groups/${seededFlockId}/cost-of-production?year=2025`);
    expect(status).toBe(200);
    expect(data.group_id).toBe(seededFlockId);
    expect(data.costs).toBeTruthy();
    expect(data).toHaveProperty('cost_per_kg_wool');
    expect(data).toHaveProperty('cost_per_kg_liveweight');
  });
  it('missing year → 400', async () => {
    const { status } = await api(`/livestock/groups/${seededFlockId}/cost-of-production`);
    expect(status).toBe(400);
  });
  it('flock with no inputs → 404', async () => {
    const { status } = await api(`/livestock/groups/${groupId}/cost-of-production?year=1999`);
    expect(status).toBe(404);
  });
});
