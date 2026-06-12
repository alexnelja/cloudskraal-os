/**
 * Spec 6a — technical calculators: six pure compute modules with textbook
 * examples + sanity-envelope warnings. Cost-linked calcs (pest, fertilizer,
 * lime) look up input_products when a db is provided.
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { computeSprayer } from '../src/services/calculators/sprayer.js';
import { computePestDose } from '../src/services/calculators/pest.js';
import { computeFertilizer } from '../src/services/calculators/fertilizer.js';
import { computeLime } from '../src/services/calculators/lime.js';
import { computeElectrical } from '../src/services/calculators/electrical.js';
import { computeFluid } from '../src/services/calculators/fluid.js';

const now = new Date().toISOString();
function dbWithProduct(name, cost_per_unit, unit = 'l') {
  const db = new Database(':memory:');
  initPhase3Schema(db);
  db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run('p1', name, 'chemical', unit, cost_per_unit, now, now);
  return db;
}

describe('sprayer calibration', () => {
  it('L/ha = nozzle L/min × 600 ÷ (speed × spacing); tank fills for a block', () => {
    const r = computeSprayer({
      nozzle_l_min: 1.2, speed_kmh: 8, nozzle_spacing_m: 0.5,
      area_ha: 6.4, tank_size_l: 2000,
    });
    expect(r.result.application_l_ha).toBe(180);      // 1.2×600/(8×0.5)
    expect(r.result.total_spray_l).toBe(1152);         // 180 × 6.4
    expect(r.result.tank_fills).toBe(0.58);
    expect(r.warnings).toEqual([]);
  });
  it('warns outside the sane envelope (<50 or >600 L/ha)', () => {
    const r = computeSprayer({ nozzle_l_min: 4, speed_kmh: 4, nozzle_spacing_m: 0.5 });
    expect(r.result.application_l_ha).toBe(1200);
    expect(r.warnings.some(w => w.includes('outside'))).toBe(true);
  });
  it('rejects missing/zero speed', () => {
    expect(computeSprayer({ nozzle_l_min: 1, speed_kmh: 0, nozzle_spacing_m: 0.5 }).error).toBeTruthy();
  });
});

describe('pest dose', () => {
  it('label rate per ha × area, with catalogue cost', () => {
    const db = dbWithProduct('Mospilan', 2.5, 'g');     // R2.50/g
    const r = computePestDose({ rate_value: 250, rate_basis: 'g_per_ha', area_ha: 6.4 }, db);
    expect(r.result.total_chemical).toBe(1600);          // g
    expect(r.result.total_cost_zar).toBeNull();          // no product named in inputs
    const r2 = computePestDose({ rate_value: 250, rate_basis: 'g_per_ha', area_ha: 6.4, product: 'Mospilan' }, db);
    expect(r2.result.total_cost_zar).toBe(4000);         // 1600 × 2.5
    db.close();
  });
  it('per-100L basis needs spray volume: chem = rate × total water ÷ 100', () => {
    const r = computePestDose({
      rate_value: 50, rate_basis: 'ml_per_100l', area_ha: 6.4, spray_volume_l_ha: 180,
    });
    expect(r.result.total_water_l).toBe(1152);
    expect(r.result.total_chemical).toBe(576);           // 50 × 1152/100
  });
  it('fuzzy-matches the catalogue and warns when no price found', () => {
    const db = dbWithProduct('Mospilan SG', 2.5, 'g');
    const r = computePestDose({ rate_value: 100, rate_basis: 'g_per_ha', area_ha: 1, product: 'mospilan' }, db);
    expect(r.result.total_cost_zar).toBe(250);
    const r2 = computePestDose({ rate_value: 100, rate_basis: 'g_per_ha', area_ha: 1, product: 'Unknownicide' }, db);
    expect(r2.result.total_cost_zar).toBeNull();
    expect(r2.warnings.some(w => w.includes('product_price_missing'))).toBe(true);
    db.close();
  });
});

describe('fertilizer rate', () => {
  it('product kg/ha = nutrient target ÷ analysis%; total + cost', () => {
    const db = dbWithProduct('LAN 28', 8, 'kg');
    const r = computeFertilizer({
      target_nutrient_kg_ha: 30, analysis_pct: 28, area_ha: 10, product: 'LAN 28',
    }, db);
    expect(r.result.product_kg_ha).toBe(107.14);          // 30/0.28
    expect(r.result.total_product_kg).toBe(1071.43);
    expect(r.result.total_cost_zar).toBe(8571.43);        // 1071.4286 × R8
    db.close();
  });
  it('rejects analysis outside 0–100', () => {
    expect(computeFertilizer({ target_nutrient_kg_ha: 30, analysis_pct: 0, area_ha: 1 }).error).toBeTruthy();
  });
});

describe('lime requirement', () => {
  it('t/ha = ΔpH × CEC × 0.75 × texture factor (guide value)', () => {
    const r = computeLime({ current_ph: 5.0, target_ph: 5.5, cec: 4, texture: 'sand', area_ha: 20 });
    expect(r.result.lime_t_ha).toBe(1.13);                // 0.5×4×0.75×0.75
    expect(r.result.total_t).toBe(22.5);
    expect(r.warnings.some(w => w.includes('agronomist'))).toBe(true); // always a guide
  });
  it('warns hard above 8 t/ha and rejects target below current', () => {
    const r = computeLime({ current_ph: 4.0, target_ph: 6.5, cec: 12, texture: 'clay', area_ha: 1 });
    expect(r.result.lime_t_ha).toBeGreaterThan(8);
    expect(r.warnings.some(w => w.includes('exceeds'))).toBe(true);
    expect(computeLime({ current_ph: 6, target_ph: 5.5, cec: 4, texture: 'loam', area_ha: 1 }).error).toBeTruthy();
  });
});

describe('electrical load (pump sizing)', () => {
  it('kW = ρgQH ÷ (3.6e6 × η); recommends next standard motor', () => {
    const r = computeElectrical({ flow_m3_h: 30, head_m: 50, efficiency_pct: 65 });
    expect(r.result.kw_required).toBe(6.29);              // 9.81×30×50/3600/0.65
    expect(r.result.recommended_motor_kw).toBe(7.5);
    expect(r.warnings).toEqual([]);
  });
  it('warns when the required power is implausibly large', () => {
    const r = computeElectrical({ flow_m3_h: 500, head_m: 400, efficiency_pct: 40 });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('fluid flow (pipe head loss)', () => {
  it('Hazen-Williams head loss for 110 mm PVC over 800 m at 30 m³/h', () => {
    const r = computeFluid({ flow_m3_h: 30, length_m: 800, diameter_mm: 110, c_factor: 150 });
    expect(r.result.head_loss_m).toBeCloseTo(5.22, 1);
    expect(r.result.velocity_m_s).toBeCloseTo(0.88, 2);
    expect(r.warnings).toEqual([]);
  });
  it('doubling length doubles head loss; high velocity warns', () => {
    const a = computeFluid({ flow_m3_h: 30, length_m: 400, diameter_mm: 110 });
    const b = computeFluid({ flow_m3_h: 30, length_m: 800, diameter_mm: 110 });
    expect(b.result.head_loss_m / a.result.head_loss_m).toBeCloseTo(2, 2);
    const fast = computeFluid({ flow_m3_h: 60, length_m: 100, diameter_mm: 75 });
    expect(fast.result.velocity_m_s).toBeGreaterThan(2);
    expect(fast.warnings.some(w => w.includes('velocity'))).toBe(true);
  });
});
