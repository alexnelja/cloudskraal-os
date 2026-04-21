/**
 * Tests for P0 backend fixes:
 *   - ON DELETE CASCADE on fields.farm_id
 *   - POST /api/financials/transactions validation (type + amount)
 *   - POST /api/budgets validation (enterprise_id + year + category)
 */
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
    headers: { 'Content-Type': 'application/json' },
    ...o,
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

// ---------------------------------------------------------------------------
// ON DELETE CASCADE: fields.farm_id
// ---------------------------------------------------------------------------
describe('ON DELETE CASCADE — fields.farm_id', () => {
  it('deleting a farm cascades to its fields', () => {
    const db = new Database(DB_PATH);
    const now = new Date().toISOString();

    const farmId = 'test-cascade-farm-' + Date.now();
    const fieldId = 'test-cascade-field-' + Date.now();

    db.prepare(`
      INSERT INTO farms (id, name, type, created_at, updated_at)
      VALUES (?, ?, 'owned', ?, ?)
    `).run(farmId, 'Cascade Test Farm', now, now);

    db.prepare(`
      INSERT INTO fields (id, farm_id, name, enterprise, created_at, updated_at)
      VALUES (?, ?, ?, 'unclassified', ?, ?)
    `).run(fieldId, farmId, 'Cascade Test Field', now, now);

    // Confirm field exists
    const before = db.prepare('SELECT id FROM fields WHERE id = ?').get(fieldId);
    expect(before).toBeTruthy();

    // Delete the farm — cascade should remove the field
    db.prepare('DELETE FROM farms WHERE id = ?').run(farmId);

    const after = db.prepare('SELECT id FROM fields WHERE id = ?').get(fieldId);
    expect(after).toBeUndefined();

    db.close();
  });
});

// ---------------------------------------------------------------------------
// POST /api/financials/transactions — validation
// ---------------------------------------------------------------------------
describe('POST /api/financials/transactions — validation', () => {
  it('returns 400 when body is empty', async () => {
    const { status, data } = await api('/financials/transactions', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('returns 400 when type is missing', async () => {
    const { status, data } = await api('/financials/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 100 }),
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/type/i);
  });

  it('returns 400 when type is invalid', async () => {
    const { status, data } = await api('/financials/transactions', {
      method: 'POST',
      body: JSON.stringify({ type: 'invoice', amount: 100 }),
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/type/i);
  });

  it('returns 400 when amount is missing', async () => {
    const { status, data } = await api('/financials/transactions', {
      method: 'POST',
      body: JSON.stringify({ type: 'revenue' }),
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/amount/i);
  });

  it('returns 400 when amount is a string', async () => {
    const { status, data } = await api('/financials/transactions', {
      method: 'POST',
      body: JSON.stringify({ type: 'expense', amount: '500' }),
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/amount/i);
  });

  it('returns 201 with valid body', async () => {
    const { status, data } = await api('/financials/transactions', {
      method: 'POST',
      body: JSON.stringify({
        type: 'expense',
        amount: 250,
        date: '2026-04-20',
        description: 'P0 test transaction',
        category: 'test',
      }),
    });
    expect(status).toBe(201);
    expect(data).toHaveProperty('id');
    expect(data.type).toBe('expense');
    expect(data.amount).toBe(250);

    // Cleanup
    const db = new Database(DB_PATH);
    db.prepare("DELETE FROM financial_transactions WHERE description = 'P0 test transaction'").run();
    db.close();
  });
});

// ---------------------------------------------------------------------------
// POST /api/budgets — validation
// ---------------------------------------------------------------------------
describe('POST /api/budgets — validation', () => {
  it('returns 400 when enterprise_id is missing', async () => {
    const { status, data } = await api('/budgets', {
      method: 'POST',
      body: JSON.stringify({ year: 2026, category: 'Revenue' }),
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/enterprise_id/i);
  });

  it('returns 400 when year is missing', async () => {
    const { status, data } = await api('/budgets', {
      method: 'POST',
      body: JSON.stringify({ enterprise_id: 'some-id', category: 'Revenue' }),
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/year/i);
  });

  it('returns 400 when category is missing', async () => {
    const { status, data } = await api('/budgets', {
      method: 'POST',
      body: JSON.stringify({ enterprise_id: 'some-id', year: 2026 }),
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/category/i);
  });

  it('returns 201 with valid body (uses real enterprise)', async () => {
    // Fetch a real enterprise to pass FK validation
    const { data: enterprises } = await api('/financials/enterprises');
    if (!enterprises || enterprises.length === 0) {
      // Skip if no enterprises seeded — don't fail the suite
      return;
    }
    const eid = enterprises[0].id;

    const { status, data } = await api('/budgets', {
      method: 'POST',
      body: JSON.stringify({
        enterprise_id: eid,
        year: 2099,
        category: 'P0TestCategory',
        jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
        jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
      }),
    });
    // 201 (new) or 200 (update if row already exists from re-run)
    expect([200, 201]).toContain(status);
    expect(data).toHaveProperty('id');

    // Cleanup
    const db = new Database(DB_PATH);
    db.prepare("DELETE FROM budgets WHERE year = 2099 AND category = 'P0TestCategory'").run();
    db.close();
  });
});
