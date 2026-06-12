/**
 * Spec 6a — calculators API (integration; server on :3001).
 */
import { describe, it, expect } from 'vitest';

const BASE = 'http://localhost:3001/api';
async function api(p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json() };
}

describe('calculators API', () => {
  it('lists the six calculators', async () => {
    const { status, data } = await api('/calculators');
    expect(status).toBe(200);
    expect(data.map(c => c.type).sort()).toEqual(
      ['electrical', 'fertilizer', 'fluid', 'lime', 'pest', 'sprayer']);
  });
  it('POST /calculators/sprayer computes', async () => {
    const { status, data } = await api('/calculators/sprayer',
      { nozzle_l_min: 1.2, speed_kmh: 8, nozzle_spacing_m: 0.5 });
    expect(status).toBe(200);
    expect(data.result.application_l_ha).toBe(180);
  });
  it('invalid inputs → 400 with the error code', async () => {
    const { status, data } = await api('/calculators/lime',
      { current_ph: 6, target_ph: 5, cec: 4, area_ha: 1 });
    expect(status).toBe(400);
    expect(data.error).toBe('target_ph_must_exceed_current');
  });
  it('unknown type → 404 with allowed list', async () => {
    const { status, data } = await api('/calculators/teleport', {});
    expect(status).toBe(404);
    expect(data.allowed).toContain('sprayer');
  });
});
