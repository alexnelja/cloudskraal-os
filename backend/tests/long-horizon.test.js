/**
 * Spec 2c/2d — long-horizon costs: capital amortization + overhead allocation.
 * Surfaced via computeFieldCop opt-in include=capital,overhead (default off).
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { initConversionFactorsSchema } from '../src/db/schema-conversion-factors.js';
import { seedConversionFactors } from '../src/db/seed-conversion-factors.js';
import { initEnterprisePricesSchema } from '../src/db/schema-enterprise-prices.js';
import { seedEnterprisePrices } from '../src/db/seed-enterprise-prices.js';
import { initLongHorizonSchema } from '../src/db/schema-long-horizon.js';
import { allocatedOverhead } from '../src/services/overhead.js';
import { computeFieldCop } from '../src/services/cop.js';

function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db); initCalendarSchema(db); initPhase3Schema(db); migrateFieldCop(db);
  initUsagePeriodsSchema(db); initConversionFactorsSchema(db); seedConversionFactors(db);
  initEnterprisePricesSchema(db); seedEnterprisePrices(db); initLongHorizonSchema(db);
  return db;
}

const now = new Date().toISOString();
function farm(db) {
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1', 'CK', 'CK', 'owned', now, now);
}
function field(db, { id, enterprise = 'rooibos', area_ha = 10 }) {
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run(id, 'farm1', id, enterprise, area_ha, '{}', now, now);
}
function usage(db, { id, field_id, usage }) {
  db.prepare(`INSERT INTO field_usage_period (id,field_id,usage,start_date,end_date,source,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run(id, field_id, usage, '2026-01-01', '2026-12-31', 'seed', now, now);
}
function cost(db, { id, field_id, total }) {
  db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run('p' + id, 'x', 'chemical', 'l', 1, now, now);
  db.prepare(`INSERT INTO inventory_transactions
    (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, 'p' + id, 'usage', '2026-03-01', 1, total, total, field_id, 'direct_variable', now);
}
function production(db, { id, field_id, yield_kg }) {
  db.prepare(`INSERT INTO field_production (id,field_id,year,actual_yield_kg,harvest_date)
              VALUES (?,?,?,?,?)`).run(id, field_id, 2026, yield_kg, '2026-02-15');
}
function establishment(db, e) {
  db.prepare(`INSERT INTO field_establishment
    (id,field_id,usage,planted_date,total_cost_zar,expected_productive_years,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(e.id, e.field_id, e.usage, e.planted_date, e.total_cost_zar, e.expected_productive_years, now, now);
}
function overheadEntry(db, e) {
  db.prepare(`INSERT INTO overhead_entries (id,year,category,amount_zar,notes,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run(e.id, e.year, e.category, e.amount_zar, null, now, now);
}
function overheadRule(db, r) {
  db.prepare(`INSERT INTO overhead_allocation_rules (id,category,method,key_params,created_at,updated_at)
              VALUES (?,?,?,?,?,?)`).run(r.id, r.category, r.method, r.key_params ?? null, now, now);
}

describe('capital amortization (2c)', () => {
  it('amortizes establishment over productive years within the window', () => {
    const db = makeDb(); farm(db);
    field(db, { id: 'f1', enterprise: 'rooibos', area_ha: 21 });
    usage(db, { id: 'u1', field_id: 'f1', usage: 'rooibos' });
    cost(db, { id: 't1', field_id: 'f1', total: 100000 });
    establishment(db, { id: 'e1', field_id: 'f1', usage: 'rooibos', planted_date: '2022-03-01', total_cost_zar: 462000, expected_productive_years: 5 });

    const line = computeFieldCop(db, 'f1', 2026, { include: ['capital'] }).lines.find(l => l.usage === 'rooibos');
    expect(line.capital_amortized_cost).toBe(92400);  // 462000 / 5, 2026 ∈ [2022,2026]
    db.close();
  });

  it('drops to zero past the productive window', () => {
    const db = makeDb(); farm(db);
    field(db, { id: 'f1', enterprise: 'rooibos', area_ha: 21 });
    // open-ended period + a 2028 cost so a rooibos line exists in 2028
    db.prepare(`INSERT INTO field_usage_period (id,field_id,usage,start_date,end_date,source,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?)`).run('u1', 'f1', 'rooibos', '2022-01-01', null, 'seed', now, now);
    db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?)`).run('p28', 'x', 'chemical', 'l', 1, now, now);
    db.prepare(`INSERT INTO inventory_transactions
      (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run('t28', 'p28', 'usage', '2028-03-01', 1, 100000, 100000, 'f1', 'direct_variable', now);
    establishment(db, { id: 'e1', field_id: 'f1', usage: 'rooibos', planted_date: '2022-03-01', total_cost_zar: 462000, expected_productive_years: 5 });
    const line = computeFieldCop(db, 'f1', 2028, { include: ['capital'] }).lines.find(l => l.usage === 'rooibos');
    expect(line.capital_amortized_cost ?? 0).toBe(0);  // 2028 > 2026 window end
    db.close();
  });

  it('is absent by default (no regression)', () => {
    const db = makeDb(); farm(db);
    field(db, { id: 'f1', enterprise: 'rooibos', area_ha: 21 });
    usage(db, { id: 'u1', field_id: 'f1', usage: 'rooibos' });
    cost(db, { id: 't1', field_id: 'f1', total: 100000 });
    establishment(db, { id: 'e1', field_id: 'f1', usage: 'rooibos', planted_date: '2022-03-01', total_cost_zar: 462000, expected_productive_years: 5 });
    const line = computeFieldCop(db, 'f1', 2026).lines.find(l => l.usage === 'rooibos');
    expect(line.capital_amortized_cost).toBeUndefined();
    db.close();
  });
});

describe('overhead allocation (2d)', () => {
  it('per_ha allocates by area share', () => {
    const db = makeDb(); farm(db);
    field(db, { id: 'f1', enterprise: 'rooibos', area_ha: 10 });
    field(db, { id: 'f2', enterprise: 'rooibos', area_ha: 30 });
    overheadEntry(db, { id: 'o1', year: 2026, category: 'admin', amount_zar: 40000 });
    overheadRule(db, { id: 'r1', category: 'admin', method: 'per_ha' });
    expect(allocatedOverhead(db, 'f1', 2026).total).toBe(10000);  // 10/40 × 40000
    expect(allocatedOverhead(db, 'f2', 2026).total).toBe(30000);
    db.close();
  });

  it('defaults to per_ha when no rule exists for the category', () => {
    const db = makeDb(); farm(db);
    field(db, { id: 'f1', enterprise: 'rooibos', area_ha: 10 });
    field(db, { id: 'f2', enterprise: 'rooibos', area_ha: 10 });
    overheadEntry(db, { id: 'o1', year: 2026, category: 'rates', amount_zar: 20000 });
    expect(allocatedOverhead(db, 'f1', 2026).total).toBe(10000);  // 50/50
    db.close();
  });

  it('per_enterprise allocates only within the matching enterprise', () => {
    const db = makeDb(); farm(db);
    field(db, { id: 'f1', enterprise: 'rooibos', area_ha: 10 });
    field(db, { id: 'f2', enterprise: 'rooibos', area_ha: 30 });
    field(db, { id: 'f3', enterprise: 'wine', area_ha: 60 });
    overheadEntry(db, { id: 'o1', year: 2026, category: 'rooibos_mgmt', amount_zar: 40000 });
    overheadRule(db, { id: 'r1', category: 'rooibos_mgmt', method: 'per_enterprise', key_params: JSON.stringify({ enterprise: 'rooibos' }) });
    expect(allocatedOverhead(db, 'f1', 2026).total).toBe(10000);  // 10/40 within rooibos
    expect(allocatedOverhead(db, 'f3', 2026).total).toBe(0);      // wine excluded
    db.close();
  });

  it('revenue_share allocates by gross-revenue share', () => {
    const db = makeDb(); farm(db);
    // two wine fields (grape_kg basis, factor 1) with seeded wine price
    field(db, { id: 'f1', enterprise: 'wine', area_ha: 10 });
    field(db, { id: 'f2', enterprise: 'wine', area_ha: 10 });
    usage(db, { id: 'u1', field_id: 'f1', usage: 'wine' });
    usage(db, { id: 'u2', field_id: 'f2', usage: 'wine' });
    production(db, { id: 'pr1', field_id: 'f1', yield_kg: 10000 });
    production(db, { id: 'pr2', field_id: 'f2', yield_kg: 30000 });
    db.prepare("UPDATE enterprise_prices SET price_per_kg=9 WHERE enterprise='wine' AND year=2026").run();
    overheadEntry(db, { id: 'o1', year: 2026, category: 'finance', amount_zar: 36000 });
    overheadRule(db, { id: 'r1', category: 'finance', method: 'revenue_share' });
    // gross: f1 90000, f2 270000 → f1 share 0.25
    expect(allocatedOverhead(db, 'f1', 2026).total).toBe(9000);
    expect(allocatedOverhead(db, 'f2', 2026).total).toBe(27000);
    db.close();
  });

  it('computeFieldCop attaches allocated_overhead_cost with include=overhead', () => {
    const db = makeDb(); farm(db);
    field(db, { id: 'f1', enterprise: 'rooibos', area_ha: 10 });
    field(db, { id: 'f2', enterprise: 'rooibos', area_ha: 30 });
    usage(db, { id: 'u1', field_id: 'f1', usage: 'rooibos' });
    cost(db, { id: 't1', field_id: 'f1', total: 50000 });
    overheadEntry(db, { id: 'o1', year: 2026, category: 'admin', amount_zar: 40000 });
    const r = computeFieldCop(db, 'f1', 2026, { include: ['overhead'] });
    const line = r.lines.find(l => l.usage === 'rooibos');
    expect(line.allocated_overhead_cost).toBe(10000);
    expect(r.overhead.total).toBe(10000);
    db.close();
  });
});
