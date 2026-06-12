/**
 * Spec 2i.5 — financing API (integration; server on :3001).
 */
import { describe, it, expect, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'capex.db');
const BASE = 'http://localhost:3001/api';
async function api(p, body, method) {
  const res = await fetch(`${BASE}${p}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}
const NOTE = '__test_financing__';

afterAll(() => {
  const db = new Database(DB_PATH);
  db.prepare('DELETE FROM financing_costs WHERE description = ?').run(NOTE);
  db.close();
});

describe('financing API', () => {
  it('POST computes interest and GET /reporting/financing rolls it up', async () => {
    const { status, data } = await api('/financing-costs', {
      year: 2099, kind: 'working_capital', description: NOTE,
      principal_zar: 500000, annual_rate_pct: 10, months: 6,
    });
    expect(status).toBe(201);
    expect(data.interest_zar).toBe(25000);
    const { data: sum } = await api('/reporting/financing?year=2099');
    expect(sum.total).toBe(25000);
    expect(sum.by_kind.working_capital).toBe(25000);
  });
  it('invalid kind → 400; rollup requires year', async () => {
    expect((await api('/financing-costs', { year: 2099, kind: 'magic' })).status).toBe(400);
    expect((await api('/reporting/financing')).status).toBe(400);
  });
});
