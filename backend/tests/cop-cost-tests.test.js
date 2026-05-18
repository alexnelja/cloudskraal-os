/**
 * Backfill tests for COP and enterprise-prices modules.
 *
 * Covers:
 *  - seedEnterprisePrices: exact rooibos forecast curve R40→R46→R55→R45→R39 (2026-2030)
 *  - usageOnDate boundary edge cases
 *  - periodsOverlappingYear multi-crop same year
 *  - computeFieldCop: known input → expected cost_per_kg invariants
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { initEnterprisePricesSchema } from '../src/db/schema-enterprise-prices.js';
import { seedEnterprisePrices } from '../src/db/seed-enterprise-prices.js';
import { usageOnDate, periodsOverlappingYear, computeFieldCop } from '../src/services/cop.js';
import { initConversionFactorsSchema } from '../src/db/schema-conversion-factors.js';
import { seedConversionFactors } from '../src/db/seed-conversion-factors.js';

// ─── shared setup ────────────────────────────────────────────────────────────

function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);
  initCalendarSchema(db);
  initPhase3Schema(db);
  migrateFieldCop(db);
  initUsagePeriodsSchema(db);
  return db;
}

function seedFarm(db) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1', 'Cloudskraal', 'CK', 'owned', now, now);
}

function seedFieldRow(db, { enterprise = 'rooibos', area_ha = 10, planted_year = null } = {}) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,planted_year,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('fld1', 'farm1', 'Blouvlei', enterprise, area_ha, planted_year, '{}', now, now);
}

function seedPeriod(db, args) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO field_usage_period
    (id,field_id,usage,start_date,end_date,planted_date,source,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    args.id, args.field_id, args.usage, args.start_date, args.end_date ?? null,
    args.planted_date ?? null, args.source ?? 'seed', now, now
  );
}

function seedInput(db, args) {
  const now = new Date().toISOString();
  try {
    db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?)`).run(args.product_id, args.product_name ?? 'Fertilizer', 'fertilizer', 'kg', 10, now, now);
  } catch {}
  db.prepare(`INSERT INTO inventory_transactions
    (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    args.id, args.product_id, 'usage', args.date, args.quantity ?? 1,
    args.unit_cost ?? 10, args.total_cost, args.field_id,
    args.cost_category ?? 'direct_variable', now
  );
}

function seedProduction(db, args) {
  db.prepare(`INSERT INTO field_production
    (id,field_id,year,estimated_yield_kg,actual_yield_kg,harvest_date,stand_pct,notes)
    VALUES (?,?,?,?,?,?,?,?)`).run(
    args.id, args.field_id, args.year,
    args.estimated ?? null, args.actual ?? null,
    args.harvest_date ?? null, args.stand_pct ?? null, args.notes ?? null
  );
}

// ─── enterprise prices seed ───────────────────────────────────────────────────

describe('seedEnterprisePrices — rooibos forecast curve', () => {
  function setup() {
    const db = new Database(':memory:');
    initEnterprisePricesSchema(db);
    return db;
  }

  const EXPECTED_CURVE = [
    { year: 2026, price_per_kg: 40 },
    { year: 2027, price_per_kg: 46 },
    { year: 2028, price_per_kg: 55 },
    { year: 2029, price_per_kg: 45 },
    { year: 2030, price_per_kg: 39 },
  ];

  it('seeds exactly 5 rooibos rows', () => {
    const db = setup();
    seedEnterprisePrices(db);
    const n = db.prepare("SELECT COUNT(*) as c FROM enterprise_prices WHERE enterprise='rooibos'").get().c;
    expect(n).toBe(5);
    db.close();
  });

  it('pins exact price per year: R40→R46→R55→R45→R39 for 2026-2030', () => {
    const db = setup();
    seedEnterprisePrices(db);
    const rows = db.prepare(
      "SELECT year, price_per_kg FROM enterprise_prices WHERE enterprise='rooibos' ORDER BY year"
    ).all();
    expect(rows).toEqual(EXPECTED_CURVE);
    db.close();
  });

  it('each individual year price is correct', () => {
    const db = setup();
    seedEnterprisePrices(db);
    const byYear = Object.fromEntries(
      db.prepare("SELECT year, price_per_kg FROM enterprise_prices WHERE enterprise='rooibos'")
        .all().map(r => [r.year, r.price_per_kg])
    );
    expect(byYear[2026]).toBe(40);
    expect(byYear[2027]).toBe(46);
    expect(byYear[2028]).toBe(55);
    expect(byYear[2029]).toBe(45);
    expect(byYear[2030]).toBe(39);
    db.close();
  });

  it('is idempotent — second seed does not duplicate rows', () => {
    const db = setup();
    seedEnterprisePrices(db);
    seedEnterprisePrices(db);
    const n = db.prepare("SELECT COUNT(*) as c FROM enterprise_prices WHERE enterprise='rooibos'").get().c;
    expect(n).toBe(5);
    db.close();
  });

  it('prices are sorted ascending by year when queried', () => {
    const db = setup();
    seedEnterprisePrices(db);
    const years = db.prepare(
      "SELECT year FROM enterprise_prices WHERE enterprise='rooibos' ORDER BY year"
    ).all().map(r => r.year);
    expect(years).toEqual([2026, 2027, 2028, 2029, 2030]);
    db.close();
  });

  it('enterprise_prices unique index prevents duplicate year insertion', () => {
    const db = setup();
    seedEnterprisePrices(db);
    const now = new Date().toISOString();
    expect(() =>
      db.prepare(`INSERT INTO enterprise_prices (id,enterprise,year,price_per_kg,notes,created_at,updated_at)
                  VALUES ('dup','rooibos',2026,99,null,?,?)`).run(now, now)
    ).toThrow();
    db.close();
  });
});

// ─── usageOnDate — boundary edge cases ───────────────────────────────────────

describe('usageOnDate — boundary edge cases', () => {
  function setup() {
    const db = makeDb();
    seedFarm(db);
    seedFieldRow(db);
    return db;
  }

  it('returns null when queried before any period exists', () => {
    const db = setup();
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2024-01-01', end_date: null });
    // query before first period
    expect(usageOnDate(db, 'fld1', '2023-12-31')).toBeNull();
    db.close();
  });

  it('matches on the exact start_date boundary (inclusive)', () => {
    const db = setup();
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2024-03-15', end_date: null });
    expect(usageOnDate(db, 'fld1', '2024-03-15')).toEqual({ usage: 'rooibos', period_id: 'p1' });
    db.close();
  });

  it('matches on the exact end_date boundary (inclusive)', () => {
    const db = setup();
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2025-05-01', end_date: '2025-09-30' });
    expect(usageOnDate(db, 'fld1', '2025-09-30')).toEqual({ usage: 'lupines_fourrages', period_id: 'p1' });
    db.close();
  });

  it('returns null one day after end_date (exclusive beyond boundary)', () => {
    const db = setup();
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2025-05-01', end_date: '2025-09-30' });
    expect(usageOnDate(db, 'fld1', '2025-10-01')).toBeNull();
    db.close();
  });

  it('handles leap year Feb 29 date inside active period', () => {
    const db = setup();
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2024-01-01', end_date: null });
    expect(usageOnDate(db, 'fld1', '2024-02-29')).toEqual({ usage: 'rooibos', period_id: 'p1' });
    db.close();
  });

  it('returns null when field_id has no periods at all', () => {
    const db = setup();
    expect(usageOnDate(db, 'fld1', '2026-06-01')).toBeNull();
    db.close();
  });
});

// ─── periodsOverlappingYear — multi-crop scenarios ───────────────────────────

describe('periodsOverlappingYear — multi-crop scenarios', () => {
  function setup() {
    const db = makeDb();
    seedFarm(db);
    seedFieldRow(db);
    return db;
  }

  it('returns both rooibos and lupines_fourrages periods that touch same year', () => {
    const db = setup();
    // rooibos ends mid-year, lupines_fourrages starts after
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: '2026-04-30' });
    seedPeriod(db, { id: 'p2', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2026-05-01', end_date: '2026-10-31' });
    const rows = periodsOverlappingYear(db, 'fld1', 2026);
    const usages = rows.map(r => r.usage).sort();
    expect(usages).toContain('rooibos');
    expect(usages).toContain('lupines_fourrages');
    expect(rows).toHaveLength(2);
    db.close();
  });

  it('preserves Afrikaans spelling lupines_fourrages unmodified', () => {
    const db = setup();
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2026-01-01', end_date: '2026-12-31' });
    const rows = periodsOverlappingYear(db, 'fld1', 2026);
    expect(rows[0].usage).toBe('lupines_fourrages');
    db.close();
  });

  it('three crops in one year all appear', () => {
    const db = setup();
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2026-01-01', end_date: '2026-03-31' });
    seedPeriod(db, { id: 'p2', field_id: 'fld1', usage: 'fallow',
      start_date: '2026-04-01', end_date: '2026-07-31' });
    seedPeriod(db, { id: 'p3', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2026-08-01', end_date: null });
    const rows = periodsOverlappingYear(db, 'fld1', 2026);
    expect(rows).toHaveLength(3);
    const usages = new Set(rows.map(r => r.usage));
    expect(usages.has('rooibos')).toBe(true);
    expect(usages.has('fallow')).toBe(true);
    expect(usages.has('lupines_fourrages')).toBe(true);
    db.close();
  });

  it('a period spanning Jan 1 to Dec 31 appears for that year only', () => {
    const db = setup();
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2026-01-01', end_date: '2026-12-31' });
    expect(periodsOverlappingYear(db, 'fld1', 2025)).toHaveLength(0);
    expect(periodsOverlappingYear(db, 'fld1', 2026)).toHaveLength(1);
    expect(periodsOverlappingYear(db, 'fld1', 2027)).toHaveLength(0);
    db.close();
  });

  it('open-ended period (end_date=null) appears for current and future years', () => {
    const db = setup();
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    expect(periodsOverlappingYear(db, 'fld1', 2026)).toHaveLength(1);
    expect(periodsOverlappingYear(db, 'fld1', 2030)).toHaveLength(1);
    db.close();
  });
});

// ─── computeFieldCop — known input matrix → expected outputs ─────────────────

describe('computeFieldCop — known input matrix', () => {
  function setup({ enterprise = 'rooibos', area_ha = 10, planted_year = null } = {}) {
    const db = makeDb();
    initConversionFactorsSchema(db);
    seedConversionFactors(db);
    seedFarm(db);
    seedFieldRow(db, { enterprise, area_ha, planted_year });
    return db;
  }

  it('R1000 cost / 500 kg actual yield = R2.00/kg exactly', () => {
    const db = setup();
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    seedInput(db, { id: 'i1', product_id: 'prod1', field_id: 'fld1',
      date: '2026-05-01', total_cost: 1000 });
    seedProduction(db, { id: 'y1', field_id: 'fld1', year: 2026,
      actual: 500, harvest_date: '2026-02-15' });
    const r = computeFieldCop(db, 'fld1', 2026);
    const line = r.lines.find(l => l.usage === 'rooibos');
    expect(line.cost_per_kg).toBe(2.00);
    expect(line.total_cost).toBe(1000);
    expect(line.actual_yield_kg).toBe(500);
    db.close();
  });

  it('cost_per_ha = total_cost / area_ha exactly', () => {
    const db = setup({ area_ha: 5 });
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    seedInput(db, { id: 'i1', product_id: 'prod1', field_id: 'fld1',
      date: '2026-05-01', total_cost: 750 });
    const r = computeFieldCop(db, 'fld1', 2026);
    const line = r.lines.find(l => l.usage === 'rooibos');
    expect(line.cost_per_ha).toBe(150);  // 750 / 5
    db.close();
  });

  it('rooibos dried denominator: 1000 wet kg × 0.45 = 450 dried, R100 / 450 = R0.22/kg', () => {
    const db = setup({ enterprise: 'rooibos', area_ha: 10 });
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    seedInput(db, { id: 'i1', product_id: 'prod1', field_id: 'fld1',
      date: '2026-05-01', total_cost: 100 });
    seedProduction(db, { id: 'y1', field_id: 'fld1', year: 2026,
      actual: 1000, harvest_date: '2026-02-15' });
    const r = computeFieldCop(db, 'fld1', 2026, { denominator: 'dried' });
    const line = r.lines.find(l => l.usage === 'rooibos');
    expect(line.yield_in_denominator_kg).toBeCloseTo(450, 1);
    expect(line.cost_per_kg).toBeCloseTo(100 / 450, 2);
    db.close();
  });

  it('rooibos netto_dry: 1000 wet × 0.45 × 0.87 = 391.5 kg, costs scale correctly', () => {
    const db = setup({ enterprise: 'rooibos', area_ha: 10 });
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    seedInput(db, { id: 'i1', product_id: 'prod1', field_id: 'fld1',
      date: '2026-05-01', total_cost: 1000 });
    seedProduction(db, { id: 'y1', field_id: 'fld1', year: 2026,
      actual: 1000, harvest_date: '2026-02-15' });
    const r = computeFieldCop(db, 'fld1', 2026, { denominator: 'netto_dry' });
    const line = r.lines.find(l => l.usage === 'rooibos');
    const expectedDry = 1000 * 0.45 * 0.87;   // 391.5
    expect(line.yield_in_denominator_kg).toBeCloseTo(expectedDry, 1);
    expect(line.cost_per_kg).toBeCloseTo(1000 / expectedDry, 2);
    db.close();
  });

  it('rotation: two crops, costs split by period boundary, total correct', () => {
    const db = setup();
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: '2026-03-31' });
    seedPeriod(db, { id: 'p2', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2026-05-01', end_date: '2026-12-31' });
    seedInput(db, { id: 'i1', product_id: 'prod1', field_id: 'fld1',
      date: '2026-01-15', total_cost: 200 });  // rooibos period
    seedInput(db, { id: 'i2', product_id: 'prod1', field_id: 'fld1',
      date: '2026-06-15', total_cost: 350 });  // lupines period
    const r = computeFieldCop(db, 'fld1', 2026);
    const rooibos = r.lines.find(l => l.usage === 'rooibos');
    const lupines = r.lines.find(l => l.usage === 'lupines_fourrages');
    expect(rooibos.total_input_cost).toBe(200);
    expect(lupines.total_input_cost).toBe(350);
    expect(r.totals.total_cost).toBe(550);
    db.close();
  });

  it('lupines_fourrages line has usage spelled correctly in output', () => {
    const db = setup();
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2026-01-01', end_date: null });
    seedInput(db, { id: 'i1', product_id: 'prod1', field_id: 'fld1',
      date: '2026-06-01', total_cost: 100 });
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.lines.some(l => l.usage === 'lupines_fourrages')).toBe(true);
    db.close();
  });

  it('returns null for unknown field_id', () => {
    const db = setup();
    expect(computeFieldCop(db, 'nonexistent', 2026)).toBeNull();
    db.close();
  });
});
