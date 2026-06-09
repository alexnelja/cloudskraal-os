/**
 * Spec 2c/2d API — field-establishment, overhead-entries, allocation-rules.
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
const SENT = '__test_lh_api__';
let fieldId;

beforeAll(() => {
  const db = new Database(DB_PATH, { readonly: true });
  fieldId = db.prepare("SELECT id FROM fields WHERE enterprise='rooibos' LIMIT 1").get()?.id;
  db.close();
});
afterAll(() => {
  const db = new Database(DB_PATH);
  db.prepare('DELETE FROM field_establishment WHERE notes = ?').run(SENT);
  db.prepare('DELETE FROM overhead_entries WHERE category = ?').run(SENT);
  db.prepare("DELETE FROM overhead_allocation_rules WHERE category = ?").run(SENT);
  db.close();
});

describe('long-horizon API (2c/2d)', () => {
  it('POST field-establishment', async () => {
    const { status, data } = await api('/field-establishment', {
      method: 'POST',
      body: JSON.stringify({ field_id: fieldId, usage: 'rooibos', planted_date: '2022-03-01', total_cost_zar: 462000, expected_productive_years: 5, notes: SENT }),
    });
    expect(status).toBe(201);
    expect(data.total_cost_zar).toBe(462000);
  });

  it('POST field-establishment unknown field → 400', async () => {
    const { status } = await api('/field-establishment', {
      method: 'POST', body: JSON.stringify({ field_id: 'nope', notes: SENT }),
    });
    expect(status).toBe(400);
  });

  it('POST overhead-entry + allocation rule, then field overhead rolls up', async () => {
    await api('/overhead-entries', { method: 'POST', body: JSON.stringify({ year: 2099, category: SENT, amount_zar: 40000 }) });
    await api('/overhead-allocation-rules', { method: 'POST', body: JSON.stringify({ category: SENT, method: 'per_ha' }) });
    const { status, data } = await api(`/fields/${fieldId}/overhead?year=2099`);
    expect(status).toBe(200);
    expect(data.total).toBeGreaterThan(0);
  });

  it('rejects an invalid allocation method', async () => {
    const { status } = await api('/overhead-allocation-rules', {
      method: 'POST', body: JSON.stringify({ category: SENT, method: 'magic' }),
    });
    expect(status).toBe(400);
  });

  it('cost-of-production accepts ?include=capital,overhead', async () => {
    const { status } = await api(`/fields/${fieldId}/cost-of-production?year=2026&include=capital,overhead`);
    expect(status).toBe(200);
  });
});
