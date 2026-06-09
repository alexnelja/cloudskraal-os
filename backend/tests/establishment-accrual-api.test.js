/**
 * Spec 2i.4 — establishment accrual API (integration; requires server on :3001).
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
const NOTE = '__test_establishment_accrual__';
let fieldId, estId;

beforeAll(async () => {
  const db = new Database(DB_PATH, { readonly: true });
  fieldId = db.prepare("SELECT id FROM fields WHERE enterprise='rooibos' AND area_ha > 0 LIMIT 1").get()?.id;
  db.close();
  const { data } = await api('/field-establishment', {
    method: 'POST',
    body: JSON.stringify({ field_id: fieldId, usage: 'rooibos', planted_date: '2026-08-01',
      expected_productive_years: 10, notes: NOTE }),
  });
  estId = data.id;
});
afterAll(async () => {
  const db = new Database(DB_PATH);
  for (const e of db.prepare('SELECT id FROM field_establishment WHERE notes = ?').all(NOTE)) {
    db.prepare('DELETE FROM field_establishment WHERE id = ?').run(e.id);
  }
  db.close();
});

describe('field-establishment accrue API', () => {
  it('POST /field-establishment/:id/accrue recomputes total_cost_zar', async () => {
    const { status, data } = await api(`/field-establishment/${estId}/accrue`, { method: 'POST' });
    expect(status).toBe(200);
    expect(typeof data.total_cost_zar).toBe('number');
    expect(data.planted_year).toBe(2026);
  });
  it('404s on an unknown establishment id', async () => {
    const { status } = await api('/field-establishment/nope/accrue', { method: 'POST' });
    expect(status).toBe(404);
  });
});
