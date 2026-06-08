/**
 * Spec 2g.1 — Wine vineyard COP + grape margin (reuses computeFieldCop + margin).
 * Cloudskraal sells grapes per kg → price_basis = grape_kg (factor 1 from harvest base).
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
import { initConversionFactorsSchema } from '../src/db/schema-conversion-factors.js';
import { seedConversionFactors } from '../src/db/seed-conversion-factors.js';
import { computeFieldCop, resolveDenominator, TIER_MAPS } from '../src/services/cop.js';

function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db); initCalendarSchema(db); initPhase3Schema(db); migrateFieldCop(db);
  initUsagePeriodsSchema(db); initConversionFactorsSchema(db); seedConversionFactors(db);
  initEnterprisePricesSchema(db); seedEnterprisePrices(db);
  return db;
}

function seedWineField(db, { cost = 200000, grape_kg = 50000, area_ha = 10 } = {}) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1', 'CK', 'CK', 'owned', now, now);
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run('w1', 'farm1', 'Kromvlei', 'wine', area_ha, '{}', now, now);
  db.prepare(`INSERT INTO field_usage_period (id,field_id,usage,start_date,end_date,source,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run('p1', 'w1', 'wine', '2026-01-01', '2026-12-31', 'seed', now, now);
  db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run('pr1', 'Spray', 'chemical', 'l', 10, now, now);
  db.prepare(`INSERT INTO inventory_transactions
    (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run('t1', 'pr1', 'usage', '2026-03-01', 1, cost, cost, 'w1', 'direct_variable', now);
  db.prepare(`INSERT INTO field_production (id,field_id,year,actual_yield_kg,harvest_date)
              VALUES (?,?,?,?,?)`).run('fp1', 'w1', 2026, grape_kg, '2026-02-15');
}

describe('wine seeds (2g.1)', () => {
  it('seeds the wine conversion chain harvest_wet_kg → grape_kg → wine_litres → bottle_750ml', () => {
    const db = makeDb();
    const f = (from, to) => db.prepare(
      "SELECT factor FROM conversion_factors WHERE context='wine' AND from_uom=? AND to_uom=?").get(from, to);
    expect(f('harvest_wet_kg', 'grape_kg')?.factor).toBe(1);
    expect(f('grape_kg', 'wine_litres')?.factor).toBe(0.72);
    expect(f('wine_litres', 'bottle_750ml')?.factor).toBeCloseTo(1.333, 2);
    db.close();
  });

  it('seeds a wine grape price quoted on grape_kg', () => {
    const db = makeDb();
    const row = db.prepare("SELECT price_per_kg, price_basis FROM enterprise_prices WHERE enterprise='wine' ORDER BY year LIMIT 1").get();
    expect(row).toBeTruthy();
    expect(row.price_basis).toBe('grape_kg');
    expect(row.price_per_kg).toBeGreaterThan(0);
    db.close();
  });

  it('TIER_MAPS.wine resolves denominator aliases', () => {
    expect(TIER_MAPS.wine).toBeTruthy();
    expect(resolveDenominator('wine', 'grape')).toBe('grape_kg');
    expect(resolveDenominator('wine', 'bottle')).toBe('bottle_750ml');
  });
});

describe('wine vineyard COP margin (2g.1)', () => {
  it('computes grape-basis margin for a wine field via the existing engine', () => {
    const db = makeDb();
    seedWineField(db, { cost: 200000, grape_kg: 50000, area_ha: 10 });
    // override the seeded benchmark price to a known value for an exact assertion
    db.prepare("UPDATE enterprise_prices SET price_per_kg=9 WHERE enterprise='wine' AND year=2026").run();

    const r = computeFieldCop(db, 'w1', 2026);
    const line = r.lines.find(l => l.usage === 'wine');
    expect(line.cost_per_kg).toBe(4);                 // 200000 / 50000
    expect(line.margin).toBeTruthy();
    expect(line.margin.price_basis).toBe('grape_kg');
    expect(line.margin.yield_at_price_basis_kg).toBe(50000);  // factor 1
    expect(line.margin.cost_per_kg_at_price_basis).toBe(4);
    expect(line.margin.margin_per_kg).toBe(5);         // 9 − 4
    expect(line.margin.gross_revenue).toBe(450000);    // 9 × 50000
    expect(line.margin.margin_total).toBe(250000);
    expect(line.margin.margin_per_ha).toBe(25000);
    expect(line.margin.margin_pct).toBe(55.56);
    db.close();
  });
});
