/**
 * Spec 2h.3 — reporting API (integration; server on :3001).
 */
import { describe, it, expect } from 'vitest';

const BASE = 'http://localhost:3001/api';
async function api(p) {
  const res = await fetch(`${BASE}${p}`);
  return { status: res.status, data: await res.json() };
}

describe('reporting API', () => {
  it('GET /reporting/enterprises returns rows for the farm enterprises', async () => {
    const { status, data } = await api('/reporting/enterprises?year=2026');
    expect(status).toBe(200);
    expect(Array.isArray(data.enterprises)).toBe(true);
    expect(data.enterprises.map(e => e.enterprise)).toContain('rooibos');
    const roo = data.enterprises.find(e => e.enterprise === 'rooibos');
    expect(roo).toHaveProperty('cost_per_kg_variable');
    expect(roo).toHaveProperty('cost_per_kg_loaded');
    expect(Array.isArray(data.flocks)).toBe(true);
  });
  it('GET /reporting/data-quality returns farm-wide counters', async () => {
    const { status, data } = await api('/reporting/data-quality?year=2026');
    expect(status).toBe(200);
    expect(data).toHaveProperty('uncategorized');
    expect(data).toHaveProperty('costed_no_yield');
    expect(data).toHaveProperty('warning_counts');
    expect(data.fields_scanned).toBeGreaterThan(0);
  });
  it('both require year', async () => {
    expect((await api('/reporting/enterprises')).status).toBe(400);
    expect((await api('/reporting/data-quality')).status).toBe(400);
  });
});
