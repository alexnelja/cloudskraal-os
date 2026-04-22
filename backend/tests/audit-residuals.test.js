/**
 * Tests for the second batch of backend audit residuals:
 *   - 7 new ON DELETE CASCADE / SET NULL foreign keys (migrate-fk-cascades)
 *   - validateBody rejects __proto__ / constructor / prototype keys
 *   - calendar sync/link errors return generic message (no raw err.message leak)
 *
 * Requires `PORT=3001 node src/index.js` to be running.
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

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
// FK cascades — direct SQLite check (faster than HTTP + covers FKs with no HTTP endpoint)
// ---------------------------------------------------------------------------
describe('FK cascades from migrate-fk-cascades', () => {
  it('deleting an enterprise cascades to its budgets', () => {
    const db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');

    const eid = randomUUID();
    db.prepare('INSERT INTO enterprises (id, name, type) VALUES (?, ?, ?)').run(eid, 'FK-TEST', 'test');
    db.prepare(
      'INSERT INTO budgets (id, enterprise_id, year, category) VALUES (?, ?, ?, ?)',
    ).run(randomUUID(), eid, 2099, 'FK-CASCADE-TEST');

    const before = db.prepare('SELECT COUNT(*) AS n FROM budgets WHERE enterprise_id = ?').get(eid).n;
    expect(before).toBe(1);

    db.prepare('DELETE FROM enterprises WHERE id = ?').run(eid);

    const after = db.prepare('SELECT COUNT(*) AS n FROM budgets WHERE enterprise_id = ?').get(eid).n;
    expect(after).toBe(0);
    db.close();
  });

  it('deleting an enterprise sets financial_transactions.enterprise_id to NULL (history kept)', () => {
    const db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');

    const eid = randomUUID();
    const txid = randomUUID();
    db.prepare('INSERT INTO enterprises (id, name, type) VALUES (?, ?, ?)').run(eid, 'FK-TEST-2', 'test');
    db.prepare(
      'INSERT INTO financial_transactions (id, date, description, type, amount, enterprise_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(txid, '2099-01-01', 'FK-SETNULL-TEST', 'expense', 1, eid, new Date().toISOString());

    db.prepare('DELETE FROM enterprises WHERE id = ?').run(eid);

    const row = db.prepare('SELECT enterprise_id FROM financial_transactions WHERE id = ?').get(txid);
    expect(row).toBeDefined();
    expect(row.enterprise_id).toBeNull();

    // Cleanup the orphaned tx
    db.prepare('DELETE FROM financial_transactions WHERE id = ?').run(txid);
    db.close();
  });

  it('deleting a livestock group cascades to breeding_seasons and shearing_records', () => {
    const db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');
    const now = new Date().toISOString();

    const gid = randomUUID();
    db.prepare(
      'INSERT INTO livestock_groups (id, name, species, head_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(gid, 'FK-G', 'sheep', 10, now, now);
    db.prepare(
      'INSERT INTO breeding_seasons (id, group_id, year, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run(randomUUID(), gid, 2099, now, now);
    db.prepare(
      'INSERT INTO shearing_records (id, group_id, date, created_at) VALUES (?, ?, ?, ?)',
    ).run(randomUUID(), gid, '2099-01-01', now);

    db.prepare('DELETE FROM livestock_groups WHERE id = ?').run(gid);

    expect(db.prepare('SELECT COUNT(*) AS n FROM breeding_seasons WHERE group_id = ?').get(gid).n).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM shearing_records WHERE group_id = ?').get(gid).n).toBe(0);
    db.close();
  });

  it('deleting an input_product cascades to inventory_transactions', () => {
    const db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');
    const now = new Date().toISOString();

    const pid = randomUUID();
    db.prepare(
      'INSERT INTO input_products (id, name, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run(pid, 'FK-P', 'fertiliser', now, now);
    db.prepare(
      'INSERT INTO inventory_transactions (id, product_id, type, date, quantity, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(randomUUID(), pid, 'purchase', '2099-01-01', 1, now);

    db.prepare('DELETE FROM input_products WHERE id = ?').run(pid);

    expect(db.prepare('SELECT COUNT(*) AS n FROM inventory_transactions WHERE product_id = ?').get(pid).n).toBe(0);
    db.close();
  });
});

// ---------------------------------------------------------------------------
// Prototype-pollution rejection
// ---------------------------------------------------------------------------
describe('validateBody — prototype pollution guard', () => {
  it('rejects __proto__ top-level key on POST /api/financials/transactions', async () => {
    // `JSON.stringify({ __proto__: ... })` drops the key (sets prototype,
    // not an own property). We need the literal JSON payload to reach the
    // parser, which then hydrates __proto__ as an own property on req.body.
    const r = await api('/financials/transactions', {
      method: 'POST',
      body: '{"__proto__":{"polluted":true},"type":"expense","amount":1,"date":"2099-01-01"}',
    });
    expect(r.status).toBe(400);
    expect(r.data.code).toBe('FORBIDDEN_KEY');
  });

  it('rejects constructor top-level key on POST /api/budgets', async () => {
    const r = await api('/budgets', {
      method: 'POST',
      body: '{"constructor":"x","enterprise_id":"e","year":2099,"category":"c"}',
    });
    expect(r.status).toBe(400);
    expect(r.data.code).toBe('FORBIDDEN_KEY');
  });
});

// ---------------------------------------------------------------------------
// Google Calendar error messages no longer leak err.message
// ---------------------------------------------------------------------------
describe('calendar sync/link error response shape', () => {
  it('POST /api/calendar/sync returns generic message on failure (no raw err.message)', async () => {
    // Unless Google credentials are wired up in this test environment, sync fails.
    // In either case the shape must be { error: <string> } with NO `message` field.
    const r = await api('/calendar/sync', { method: 'POST' });
    if (r.status === 500) {
      expect(r.data).toHaveProperty('error');
      expect(r.data).not.toHaveProperty('message');
      expect(r.data.error).toMatch(/Check server logs/i);
    }
    // If the sync succeeded (creds configured in dev), the test is a no-op —
    // the guard only applies in the error path, which we can't force
    // deterministically without mocking the google-calendar service.
  });
});
