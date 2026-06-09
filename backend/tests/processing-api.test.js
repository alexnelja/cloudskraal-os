/**
 * Spec 2e.1 — processing-batches API (integration; requires server on :3001).
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
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
const SENTINEL = '__test_proc_api__';
let fieldId;

beforeAll(() => {
  const db = new Database(DB_PATH, { readonly: true });
  fieldId = db.prepare("SELECT id FROM fields WHERE enterprise='rooibos' LIMIT 1").get()?.id;
  db.close();
});

afterAll(() => {
  const db = new Database(DB_PATH);
  for (const b of db.prepare('SELECT id FROM processing_batches WHERE notes = ?').all(SENTINEL)) {
    db.prepare('DELETE FROM processing_batch_sources WHERE batch_id = ?').run(b.id);
    db.prepare('DELETE FROM processing_batch_fractions WHERE batch_id = ?').run(b.id);
    db.prepare('DELETE FROM processing_batches WHERE id = ?').run(b.id);
  }
  db.close();
});

describe('processing-batches API', () => {
  let batchId;
  it('POST creates a batch', async () => {
    const { status, data } = await api('/processing-batches', {
      method: 'POST',
      body: JSON.stringify({ enterprise: 'rooibos', end_date: '2026-03-01', wet_in_kg: 10000, sifted_netto_kg: 3900, processing_cost_zar: 5000, notes: SENTINEL }),
    });
    expect(status).toBe(201);
    batchId = data.id;
  });

  it('GET :id returns yield + sources', async () => {
    const { status, data } = await api(`/processing-batches/${batchId}`);
    expect(status).toBe(200);
    expect(data.yield.shrinkage_actual).toBe(0.39);
    expect(Array.isArray(data.sources)).toBe(true);
  });

  it('POST a source contribution', async () => {
    const { status } = await api(`/processing-batches/${batchId}/sources`, {
      method: 'POST',
      body: JSON.stringify({ field_id: fieldId, wet_contributed_kg: 6000 }),
    });
    expect(status).toBe(201);
  });

  it('field processing-share requires a year', async () => {
    const { status } = await api('/fields/'+fieldId+'/processing-share');
    expect(status).toBe(400);
  });

  it('POST a graded fraction + reject bad grade; byproduct shows in yield', async () => {
    // own batch to avoid polluting the share test's batch
    const b2 = (await api('/processing-batches', {
      method: 'POST', body: JSON.stringify({ enterprise: 'rooibos', end_date: '2026-04-01', wet_in_kg: 5000, sifted_netto_kg: 2000, processing_cost_zar: 1000, notes: SENTINEL }),
    })).data.id;
    const good = await api(`/processing-batches/${b2}/fractions`, {
      method: 'POST', body: JSON.stringify({ grade: 'superfine', kg: 200, sold_kg: 150, price_zar_per_kg: 30 }),
    });
    expect(good.status).toBe(201);
    const bad = await api(`/processing-batches/${b2}/fractions`, {
      method: 'POST', body: JSON.stringify({ grade: 'nonsense', kg: 1 }),
    });
    expect(bad.status).toBe(400);
    const { data } = await api(`/processing-batches/${b2}`);
    expect(data.yield.byproduct_revenue).toBe(4500);  // 150 × 30
  });

  it('field processing-share rolls up the batch', async () => {
    const { status, data } = await api('/fields/'+fieldId+'/processing-share?year=2026');
    expect(status).toBe(200);
    // single source of 6000 is the only fresh wet → 100% share (fresh-wet denominator)
    expect(data.sifted_netto_kg).toBe(3900);
    expect(data.processing_cost).toBe(5000);
  });
});
