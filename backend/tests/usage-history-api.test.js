import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'capex.db');

const BASE = 'http://localhost:3001/api';

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

let fieldId;

beforeAll(async () => {
  const { data } = await api('/fields');
  expect(Array.isArray(data)).toBe(true);
  expect(data.length).toBeGreaterThan(0);
  // Pick an annual-crop field so 2030 POSTs don't collide with perennial open-ended seeds.
  const annual = data.find(f => ['lupines_fourrages', 'oats', 'fallow', 'lupines'].includes(f.enterprise));
  fieldId = (annual ?? data[0]).id;
});

afterAll(() => {
  // Hard-delete test-injected rows (start_date 2030+ used only by tests).
  // Keeps integration tests idempotent across repeated runs.
  const db = new Database(DB_PATH);
  db.prepare(`DELETE FROM field_usage_period WHERE start_date >= '2030-01-01'`).run();
  db.close();
});

describe('usage-periods CRUD', () => {
  const createdIds = [];

  it('GET /fields/:id/usage-periods returns seeded rows', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('POST rejects unknown usage', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`, {
      method: 'POST',
      body: JSON.stringify({ usage: 'unicorns', start_date: '2030-01-01' }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('invalid_usage');
    expect(Array.isArray(data.valid)).toBe(true);
  });

  it('POST rejects end_date before start_date', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`, {
      method: 'POST',
      body: JSON.stringify({ usage: 'oats', start_date: '2030-06-01', end_date: '2030-05-01' }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('invalid_interval');
  });

  it('POST creates a period in the future (avoids seed collisions)', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`, {
      method: 'POST',
      body: JSON.stringify({ usage: 'oats', start_date: '2030-01-01', end_date: '2030-12-31' }),
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    expect(data.source).toBe('manual');
    createdIds.push(data.id);
  });

  it('POST overlapping period returns 409', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`, {
      method: 'POST',
      body: JSON.stringify({ usage: 'oats', start_date: '2030-06-01', end_date: '2031-05-31' }),
    });
    expect(status).toBe(409);
    expect(data.error).toBe('overlap');
    expect(data.conflict).toBe(createdIds[0]);
  });

  it('POST adjacent period is allowed', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`, {
      method: 'POST',
      body: JSON.stringify({ usage: 'lupines_fourrages', start_date: '2030-12-31', end_date: '2031-06-30' }),
    });
    expect(status).toBe(201);
    createdIds.push(data.id);
  });

  it('PUT updates an existing period', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods/${createdIds[0]}`, {
      method: 'PUT',
      body: JSON.stringify({ notes: 'updated' }),
    });
    expect(status).toBe(200);
    expect(data.notes).toBe('updated');
  });

  it('PUT on missing period returns 404', async () => {
    const { status } = await api(`/fields/${fieldId}/usage-periods/nonexistent`, {
      method: 'PUT',
      body: JSON.stringify({ notes: 'x' }),
    });
    expect(status).toBe(404);
  });

  it('DELETE soft-deletes', async () => {
    const target = createdIds[1];
    const del = await api(`/fields/${fieldId}/usage-periods/${target}`, { method: 'DELETE' });
    expect(del.status).toBe(204);
    const list = await api(`/fields/${fieldId}/usage-periods`);
    const ids = list.data.map(p => p.id);
    expect(ids).not.toContain(target);
  });

  it('PATCH /fields/:id rejects enterprise write', async () => {
    const { status, data } = await api(`/fields/${fieldId}`, {
      method: 'PATCH',
      body: JSON.stringify({ enterprise: 'lupines_fourrages' }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('read_only');
  });
});

describe('perennial warning', () => {
  it('POST rooibos with rotation_year returns warning', async () => {
    const { status, data } = await api(`/fields/${fieldId}/usage-periods`, {
      method: 'POST',
      body: JSON.stringify({
        usage: 'rooibos', start_date: '2040-01-01', end_date: '2040-12-31',
        planted_date: '2040-01-01', rotation_year: 1,
      }),
    });
    expect(status).toBe(201);
    expect(data.warning).toBe('rotation_year_on_perennial');
    await api(`/fields/${fieldId}/usage-periods/${data.id}`, { method: 'DELETE' });
  });
});

describe('usage-history map feed', () => {
  it('GET /usage-history returns rows joined with geometry', async () => {
    const { status, data } = await api('/usage-history?as_of=2026-04-14');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    const row = data[0];
    expect(row).toHaveProperty('field_id');
    expect(row).toHaveProperty('usage');
    expect(row).toHaveProperty('geometry');
  });

  it('GET /usage-history?as_of=2020-01-01 returns fewer rows (pre-planting)', async () => {
    const recent = await api('/usage-history?as_of=2026-04-14');
    const old = await api('/usage-history?as_of=2020-01-01');
    expect(old.data.length).toBeLessThan(recent.data.length);
  });

  it('GET /usage-history defaults as_of to today', async () => {
    const { status } = await api('/usage-history');
    expect(status).toBe(200);
  });
});
