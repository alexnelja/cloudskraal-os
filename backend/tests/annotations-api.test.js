import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'capex.db');

const BASE = 'http://localhost:3001/api';
const SENTINEL = '__ANN_TEST__';

async function api(p, options = {}) {
  const res = await fetch(`${BASE}${p}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

afterAll(() => {
  const db = new Database(DB_PATH);
  db.prepare(`DELETE FROM annotations WHERE title LIKE '${SENTINEL}%'`).run();
  db.close();
});

describe('annotations API', () => {
  const created = [];

  it('POST line returns 201 with computed length_m', async () => {
    const body = {
      type: 'line',
      title: `${SENTINEL} fence`,
      notes: 'broken post',
      geometry: { type: 'LineString', coordinates: [[19.0, -31.3], [19.001, -31.3]] },
    };
    const { status, data } = await api('/annotations', { method: 'POST', body: JSON.stringify(body) });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    expect(data.type).toBe('line');
    expect(data.title).toBe(`${SENTINEL} fence`);
    expect(data.notes).toBe('broken post');
    expect(data.length_m).toBeGreaterThan(0);
    expect(data.area_m2).toBeNull();
    created.push(data.id);
  });

  it('POST polygon returns 201 with computed area_m2', async () => {
    const body = {
      type: 'polygon',
      title: `${SENTINEL} paddock`,
      geometry: {
        type: 'Polygon',
        coordinates: [[[19.0, -31.3], [19.001, -31.3], [19.001, -31.299], [19.0, -31.299], [19.0, -31.3]]],
      },
    };
    const { status, data } = await api('/annotations', { method: 'POST', body: JSON.stringify(body) });
    expect(status).toBe(201);
    expect(data.area_m2).toBeGreaterThan(0);
    expect(data.length_m).toBeNull();
    created.push(data.id);
  });

  it('POST pin returns 201 with no metrics', async () => {
    const body = {
      type: 'pin',
      title: `${SENTINEL} gate`,
      geometry: { type: 'Point', coordinates: [19.0, -31.3] },
    };
    const { status, data } = await api('/annotations', { method: 'POST', body: JSON.stringify(body) });
    expect(status).toBe(201);
    expect(data.length_m).toBeNull();
    expect(data.area_m2).toBeNull();
    created.push(data.id);
  });

  it('POST rejects missing title', async () => {
    const { status, data } = await api('/annotations', {
      method: 'POST',
      body: JSON.stringify({ type: 'pin', geometry: { type: 'Point', coordinates: [0, 0] } }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('title_required');
  });

  it('POST rejects type/geometry mismatch', async () => {
    const { status, data } = await api('/annotations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'line',
        title: `${SENTINEL} bad`,
        geometry: { type: 'Point', coordinates: [0, 0] },
      }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('type_mismatch');
  });

  it('GET /annotations includes just-created items', async () => {
    const { status, data } = await api('/annotations');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    for (const id of created) {
      expect(data.some((r) => r.id === id)).toBe(true);
    }
  });

  it('GET /annotations?type=pin filters', async () => {
    const { status, data } = await api('/annotations?type=pin');
    expect(status).toBe(200);
    expect(data.every((r) => r.type === 'pin')).toBe(true);
  });

  it('GET by id returns 404 for missing', async () => {
    const { status } = await api('/annotations/does-not-exist');
    expect(status).toBe(404);
  });

  it('PATCH updates title and notes', async () => {
    const id = created[0];
    const { status, data } = await api(`/annotations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: `${SENTINEL} renamed`, notes: 'updated' }),
    });
    expect(status).toBe(200);
    expect(data.title).toBe(`${SENTINEL} renamed`);
    expect(data.notes).toBe('updated');
  });

  it('PATCH rejects geometry change', async () => {
    const id = created[0];
    const { status, data } = await api(`/annotations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ geometry: { type: 'Point', coordinates: [0, 0] } }),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('immutable_field');
  });

  it('DELETE returns 204 and item is gone', async () => {
    const id = created.pop();
    const delRes = await api(`/annotations/${id}`, { method: 'DELETE' });
    expect(delRes.status).toBe(204);
    const getRes = await api(`/annotations/${id}`);
    expect(getRes.status).toBe(404);
  });
});
