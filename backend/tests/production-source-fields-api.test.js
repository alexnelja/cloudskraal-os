/**
 * v1.0.0 release gate — normalize production_batches.source_field_ids.
 *
 * The old design stored a JSON-encoded array in a TEXT column (returned to
 * clients as a raw JSON string). This normalizes it into a
 * production_batch_source_fields junction table with FK integrity, and the API
 * now exposes source_field_ids as a real string[] (empty when none).
 *
 * Production batch routes had zero test coverage before this file.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'capex.db');
const BASE = 'http://localhost:3001/api';
const SENTINEL = '__PROD_SRCFIELD_TEST__';

let FIELD_A, FIELD_B;

async function api(p, options = {}) {
  const res = await fetch(`${BASE}${p}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

beforeAll(() => {
  const db = new Database(DB_PATH);
  const fields = db.prepare('SELECT id FROM fields LIMIT 2').all();
  db.close();
  expect(fields.length).toBe(2); // seeded fields must exist
  FIELD_A = fields[0].id;
  FIELD_B = fields[1].id;
});

afterAll(() => {
  const db = new Database(DB_PATH);
  // junction rows cascade when the batch is removed
  db.prepare(`DELETE FROM production_batches WHERE batch_code LIKE '${SENTINEL}%'`).run();
  db.close();
});

describe('production_batches source_field_ids (normalized)', () => {
  it('POST persists source fields and returns them as an array', async () => {
    const { status, data: batch } = await api('/production/batches', {
      method: 'POST',
      body: JSON.stringify({
        batch_code: `${SENTINEL}A`,
        enterprise: 'rooibos',
        source_field_ids: [FIELD_A, FIELD_B],
        initial_quantity_kg: 1000,
      }),
    });
    expect(status).toBe(201);
    expect(Array.isArray(batch.source_field_ids)).toBe(true);
    expect(batch.source_field_ids.sort()).toEqual([FIELD_A, FIELD_B].sort());

    // junction table actually populated
    const db = new Database(DB_PATH);
    const rows = db.prepare(
      'SELECT field_id FROM production_batch_source_fields WHERE batch_id = ?'
    ).all(batch.id);
    db.close();
    expect(rows.map((r) => r.field_id).sort()).toEqual([FIELD_A, FIELD_B].sort());
  });

  it('GET by id and list return source_field_ids as an array', async () => {
    const { data: created } = await api('/production/batches', {
      method: 'POST',
      body: JSON.stringify({
        batch_code: `${SENTINEL}B`,
        enterprise: 'rooibos',
        source_field_ids: [FIELD_A],
      }),
    });

    const { data: byId } = await api(`/production/batches/${created.id}`);
    expect(byId.source_field_ids).toEqual([FIELD_A]);

    const { data: list } = await api('/production/batches');
    const row = list.find((b) => b.id === created.id);
    expect(row.source_field_ids).toEqual([FIELD_A]);
  });

  it('batch with no source fields returns an empty array', async () => {
    const { data: batch } = await api('/production/batches', {
      method: 'POST',
      body: JSON.stringify({ batch_code: `${SENTINEL}C`, enterprise: 'sheep' }),
    });
    expect(batch.source_field_ids).toEqual([]);
  });

  it('PATCH replaces the source-field set; [] clears it', async () => {
    const { data: batch } = await api('/production/batches', {
      method: 'POST',
      body: JSON.stringify({
        batch_code: `${SENTINEL}D`,
        enterprise: 'rooibos',
        source_field_ids: [FIELD_A, FIELD_B],
      }),
    });

    const { data: patched } = await api(`/production/batches/${batch.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ source_field_ids: [FIELD_B] }),
    });
    expect(patched.source_field_ids).toEqual([FIELD_B]);

    const { data: cleared } = await api(`/production/batches/${batch.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ source_field_ids: [] }),
    });
    expect(cleared.source_field_ids).toEqual([]);
  });

  it('rejects unknown field ids with 400 (FK integrity)', async () => {
    const { status } = await api('/production/batches', {
      method: 'POST',
      body: JSON.stringify({
        batch_code: `${SENTINEL}E`,
        enterprise: 'rooibos',
        source_field_ids: ['no-such-field-id'],
      }),
    });
    expect(status).toBe(400);
  });

  it('deleting a batch cascades its junction rows', async () => {
    const { data: batch } = await api('/production/batches', {
      method: 'POST',
      body: JSON.stringify({
        batch_code: `${SENTINEL}F`,
        enterprise: 'rooibos',
        source_field_ids: [FIELD_A],
      }),
    });
    const db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');
    db.prepare('DELETE FROM production_batches WHERE id = ?').run(batch.id);
    const remaining = db.prepare(
      'SELECT COUNT(*) c FROM production_batch_source_fields WHERE batch_id = ?'
    ).get(batch.id).c;
    db.close();
    expect(remaining).toBe(0);
  });
});
