/**
 * Spec 2h.1 — cost node map + enterprise summary API (integration; server on :3001).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'capex.db');
const BASE = 'http://localhost:3001/api';
async function api(p) {
  const res = await fetch(`${BASE}${p}`);
  return { status: res.status, data: await res.json() };
}
let fieldId;

beforeAll(() => {
  const db = new Database(DB_PATH, { readonly: true });
  fieldId = db.prepare("SELECT id FROM fields WHERE enterprise='rooibos' AND area_ha > 0 LIMIT 1").get()?.id;
  db.close();
});

describe('cost-node-map API', () => {
  it('GET /fields/:id/cost-node-map returns the DAG with all seven layers', async () => {
    const { status, data } = await api(`/fields/${fieldId}/cost-node-map?year=2026&include=shared,activities,capital,overhead,processing`);
    expect(status).toBe(200);
    expect(data.nodes.filter(n => n.kind === 'layer').length).toBe(7);
    expect(data.nodes.some(n => n.id === 'total')).toBe(true);
    expect(data.nodes.some(n => n.id === 'unit_cost')).toBe(true);
    expect(data.summary).toBeDefined();
  });
  it('requires year', async () => {
    const { status } = await api(`/fields/${fieldId}/cost-node-map`);
    expect(status).toBe(400);
  });
  it('404s on unknown field', async () => {
    const { status } = await api('/fields/nope/cost-node-map?year=2026');
    expect(status).toBe(404);
  });
  it('GET /reporting/enterprise-summary aggregates the enterprise', async () => {
    const { status, data } = await api('/reporting/enterprise-summary?year=2026&enterprise=rooibos');
    expect(status).toBe(200);
    expect(Array.isArray(data.fields)).toBe(true);
    expect(typeof data.total_cost).toBe('number');
  });
  it('enterprise-summary requires enterprise', async () => {
    const { status } = await api('/reporting/enterprise-summary?year=2026');
    expect(status).toBe(400);
  });
});
