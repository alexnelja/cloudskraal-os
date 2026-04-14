import { describe, it, expect, afterAll } from 'vitest';
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

afterAll(() => {
  const db = new Database(DB_PATH);
  db.prepare(`DELETE FROM conversion_factors WHERE context='test_ctx'`).run();
  db.close();
});

describe('conversion-factors API', () => {
  it('GET with context filter returns seeded rooibos rows', async () => {
    const { status, data } = await api('/conversion-factors?context=rooibos');
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(2);
    const rows = data.map(r => `${r.from_uom}->${r.to_uom}`);
    expect(rows).toContain('harvest_wet_kg->dried_kg');
    expect(rows).toContain('dried_kg->sifted_netto_dry_kg');
  });

  it('GET with as_of before 2022 returns empty', async () => {
    const { data } = await api('/conversion-factors?context=rooibos&as_of=2020-01-01');
    expect(data).toEqual([]);
  });

  it('POST creates a factor row', async () => {
    const { status, data } = await api('/conversion-factors', {
      method: 'POST',
      body: JSON.stringify({
        from_uom: 'test_wet', to_uom: 'test_dry', context: 'test_ctx',
        factor: 0.5, effective_from: '2030-01-01', notes: 'unit test'
      }),
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
  });

  it('POST duplicate (same from/to/context/effective_from) → 409', async () => {
    await api('/conversion-factors', {
      method: 'POST',
      body: JSON.stringify({
        from_uom: 'test_a', to_uom: 'test_b', context: 'test_ctx',
        factor: 0.9, effective_from: '2030-01-01',
      }),
    });
    const { status, data } = await api('/conversion-factors', {
      method: 'POST',
      body: JSON.stringify({
        from_uom: 'test_a', to_uom: 'test_b', context: 'test_ctx',
        factor: 0.85, effective_from: '2030-01-01',
      }),
    });
    expect(status).toBe(409);
    expect(data.error).toBe('duplicate_factor');
  });

  it('POST factor=0 → 400 invalid_factor', async () => {
    const { status, data } = await api('/conversion-factors', {
      method: 'POST',
      body: JSON.stringify({
        from_uom: 'test_z', to_uom: 'test_y', context: 'test_ctx',
        factor: 0, effective_from: '2030-01-01',
      }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('invalid_factor');
  });

  it('POST missing field → 400 missing_field', async () => {
    const { status, data } = await api('/conversion-factors', {
      method: 'POST',
      body: JSON.stringify({ from_uom: 'test_m', context: 'test_ctx', factor: 1,
        effective_from: '2030-01-01' }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('missing_field');
  });

  it('POST bad effective_from → 400 invalid_date', async () => {
    const { status, data } = await api('/conversion-factors', {
      method: 'POST',
      body: JSON.stringify({
        from_uom: 'test_p', to_uom: 'test_q', context: 'test_ctx',
        factor: 1, effective_from: 'not-a-date',
      }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('invalid_date');
  });
});
