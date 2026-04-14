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
    headers: { 'Content-Type': 'application/json' },
    ...o,
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

let rooibosFieldId;

beforeAll(async () => {
  const { data } = await api('/fields');
  const r = data.find(f => f.enterprise === 'rooibos');
  expect(r).toBeTruthy();
  rooibosFieldId = r.id;
});

afterAll(() => {
  // Clean up test-created overhead rows (sentinel date 2099)
  const db = new Database(DB_PATH);
  db.prepare(`DELETE FROM inventory_transactions WHERE date LIKE '2099-%'`).run();
  db.close();
});

describe('cost-of-production API', () => {
  it('returns 200 with CopReport shape', async () => {
    const { status, data } = await api(`/fields/${rooibosFieldId}/cost-of-production?year=2026`);
    expect(status).toBe(200);
    expect(data).toHaveProperty('field_id', rooibosFieldId);
    expect(data).toHaveProperty('year', 2026);
    expect(Array.isArray(data.lines)).toBe(true);
    expect(data.totals).toHaveProperty('total_cost');
    expect(data.coverage.excludes).toContain('overhead');
  });

  it('missing year returns 400', async () => {
    const { status, data } = await api(`/fields/${rooibosFieldId}/cost-of-production`);
    expect(status).toBe(400);
    expect(data.error).toBe('year_required');
  });

  it('unknown field returns 404', async () => {
    const { status } = await api(`/fields/nonexistent/cost-of-production?year=2026`);
    expect(status).toBe(404);
  });

  it('overhead-tagged transactions are excluded from total_cost', async () => {
    const db = new Database(DB_PATH);
    const id = `test-overhead-${Date.now()}`;
    const now = new Date().toISOString();
    const prod = db.prepare(`SELECT id FROM input_products LIMIT 1`).get();
    expect(prod).toBeTruthy();
    db.prepare(`INSERT INTO inventory_transactions
      (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        id, prod.id, 'usage', '2099-05-01', 1, 9999, 9999, rooibosFieldId, 'overhead', now
      );
    db.close();
    const { data } = await api(`/fields/${rooibosFieldId}/cost-of-production?year=2099`);
    expect(data.totals.total_cost).toBe(0);
  });
});
