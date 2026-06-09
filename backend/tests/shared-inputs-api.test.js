/**
 * Spec 2i.1 — shared-inputs API (integration; requires server on :3001).
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
const SENT = '__test_shared_input__';
let fieldId;

beforeAll(() => {
  const db = new Database(DB_PATH, { readonly: true });
  fieldId = db.prepare("SELECT id FROM fields WHERE enterprise='rooibos' AND area_ha > 0 LIMIT 1").get()?.id;
  db.close();
});
afterAll(() => {
  const db = new Database(DB_PATH);
  for (const s of db.prepare('SELECT id FROM shared_inputs WHERE product = ?').all(SENT)) {
    db.prepare('DELETE FROM shared_input_fields WHERE shared_input_id = ?').run(s.id);
    db.prepare('DELETE FROM shared_inputs WHERE id = ?').run(s.id);
  }
  db.close();
});

describe('shared-inputs API', () => {
  it('POST creates a per-ha shared input on selected fields', async () => {
    const { status, data } = await api('/shared-inputs', {
      method: 'POST',
      body: JSON.stringify({ year: 2026, product: SENT, basis: 'per_ha_rate', rate_per_ha: 500, field_ids: [fieldId] }),
    });
    expect(status).toBe(201);
    expect(data.fields).toContain(fieldId);
  });
  it('rejects an invalid basis', async () => {
    const { status } = await api('/shared-inputs', {
      method: 'POST', body: JSON.stringify({ year: 2026, product: SENT, basis: 'magic', field_ids: [fieldId] }),
    });
    expect(status).toBe(400);
  });
  it('rejects empty field_ids', async () => {
    const { status } = await api('/shared-inputs', {
      method: 'POST', body: JSON.stringify({ year: 2026, product: SENT, basis: 'per_ha_rate', rate_per_ha: 1, field_ids: [] }),
    });
    expect(status).toBe(400);
  });
  it('field share rollup reflects the input', async () => {
    const { status, data } = await api(`/fields/${fieldId}/shared-input-cost?year=2026`);
    expect(status).toBe(200);
    expect(data.total).toBeGreaterThan(0);
  });
});
