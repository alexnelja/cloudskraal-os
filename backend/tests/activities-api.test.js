/**
 * Spec 2i.3 — field-activities API (integration; requires server on :3001).
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
const SENT = '__test_activity__';
let fieldId, equipmentId;

beforeAll(() => {
  const db = new Database(DB_PATH, { readonly: true });
  fieldId = db.prepare("SELECT id FROM fields WHERE enterprise='rooibos' AND area_ha > 0 LIMIT 1").get()?.id;
  equipmentId = db.prepare('SELECT id FROM equipment LIMIT 1').get()?.id;
  db.close();
});
afterAll(() => {
  const db = new Database(DB_PATH);
  for (const a of db.prepare('SELECT id FROM field_activities WHERE activity_type = ?').all(SENT)) {
    db.prepare('DELETE FROM field_activity_fields WHERE activity_id = ?').run(a.id);
    db.prepare('DELETE FROM field_activities WHERE id = ?').run(a.id);
  }
  db.close();
});

describe('field-activities API', () => {
  it('POST creates an activity on selected fields and returns its cost', async () => {
    const { status, data } = await api('/field-activities', {
      method: 'POST',
      body: JSON.stringify({ year: 2026, date: '2026-03-01', activity_type: SENT,
        equipment_id: equipmentId, hours: 2, fields: [fieldId] }),
    });
    expect(status).toBe(201);
    expect(data.fields.map(f => f.field_id)).toContain(fieldId);
    expect(data.cost).toBeDefined();
  });
  it('rejects missing hours', async () => {
    const { status } = await api('/field-activities', {
      method: 'POST', body: JSON.stringify({ year: 2026, activity_type: SENT, fields: [fieldId] }),
    });
    expect(status).toBe(400);
  });
  it('rejects empty fields', async () => {
    const { status } = await api('/field-activities', {
      method: 'POST', body: JSON.stringify({ year: 2026, activity_type: SENT, hours: 1, fields: [] }),
    });
    expect(status).toBe(400);
  });
  it('rejects an unknown equipment id', async () => {
    const { status, data } = await api('/field-activities', {
      method: 'POST', body: JSON.stringify({ year: 2026, activity_type: SENT, hours: 1,
        equipment_id: 'nope', fields: [fieldId] }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('equipment_not_found');
  });
  it('field rollup endpoint responds', async () => {
    const { status, data } = await api(`/fields/${fieldId}/activity-cost?year=2026`);
    expect(status).toBe(200);
    expect(typeof data.total).toBe('number');
  });
  it('GET lists by field and year', async () => {
    const { status, data } = await api(`/field-activities?field_id=${fieldId}&year=2026`);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });
});
