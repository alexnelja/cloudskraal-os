import { describe, it, expect } from 'vitest';

const BASE = 'http://localhost:3001/api';
async function api(p) {
  const res = await fetch(`${BASE}${p}`);
  return { status: res.status, data: await res.json() };
}

describe('enterprise-prices API', () => {
  it('GET ?enterprise=rooibos returns the forecast curve sorted by year', async () => {
    const { status, data } = await api('/enterprise-prices?enterprise=rooibos');
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(5);
    const years = data.map(r => r.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    const by = Object.fromEntries(data.map(r => [r.year, r.price_per_kg]));
    expect(by[2026]).toBe(40);
    expect(by[2028]).toBe(55);
    expect(by[2030]).toBe(39);
  });

  it('GET with no enterprise returns all', async () => {
    const { status, data } = await api('/enterprise-prices');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });
});
