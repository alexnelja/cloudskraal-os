/**
 * Spec 2h.3 — reporting rollups: all-enterprises comparison (variable vs
 * fully-loaded cost/kg, price, margin) + farm-wide data-quality counters.
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { initPhase2Schema } from '../src/db/schema-phase2.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { initFarmConfigSchema } from '../src/db/schema-farm-config.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { initConversionFactorsSchema } from '../src/db/schema-conversion-factors.js';
import { seedConversionFactors } from '../src/db/seed-conversion-factors.js';
import { initEnterprisePricesSchema } from '../src/db/schema-enterprise-prices.js';
import { initSharedInputsSchema } from '../src/db/schema-shared-inputs.js';
import { initActivitiesSchema } from '../src/db/schema-activities.js';
import { initProcessingSchema } from '../src/db/schema-processing.js';
import { initLongHorizonSchema } from '../src/db/schema-long-horizon.js';
import { allEnterprisesSummary, dataQuality } from '../src/services/reporting.js';

const now = new Date().toISOString();
function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db); initCalendarSchema(db); initPhase2Schema(db); initPhase3Schema(db);
  initFarmConfigSchema(db); migrateFieldCop(db); initUsagePeriodsSchema(db);
  initConversionFactorsSchema(db); seedConversionFactors(db); initEnterprisePricesSchema(db);
  initSharedInputsSchema(db); initActivitiesSchema(db); initProcessingSchema(db);
  initLongHorizonSchema(db);
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1', 'CK', 'CK', 'owned', now, now);
  return db;
}
function field(db, { id, enterprise = 'rooibos', area_ha = 10, usageFrom = '2026-01-01' }) {
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run(id, 'farm1', id, enterprise, area_ha, '{}', now, now);
  db.prepare(`INSERT INTO field_usage_period (id,field_id,usage,start_date,end_date,source,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run('u_' + id, id, enterprise, usageFrom, '2026-12-31', 'seed', now, now);
}
function inputCost(db, fieldId, total, date = '2026-03-01') {
  const pid = 'p_' + fieldId + date;
  db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run(pid, 'x', 'chemical', 'l', 1, now, now);
  db.prepare(`INSERT INTO inventory_transactions
    (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run('t_' + pid, pid, 'usage', date, 1, total, total, fieldId, 'direct_variable', now);
}
function yieldKg(db, fieldId, kg) {
  db.prepare(`INSERT INTO field_production (id,field_id,year,actual_yield_kg) VALUES (?,?,?,?)`)
    .run('y_' + fieldId, fieldId, 2026, kg);
}
function equip(db, id) {
  db.prepare(`INSERT INTO equipment
    (id,name,type,depreciation_method,purchase_price,salvage_value,useful_life_years,
     annual_use_hours,maintenance_zar_per_year,fuel_l_per_hour,kind,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, id, 'tractor', 'straight_line', 500000, 50000, 10, 900, 18000, 12, 'machine', now, now);
}
function activity(db, a) {
  db.prepare(`INSERT INTO field_activities (id,date,year,activity_type,equipment_id,hours,is_establishment,created_at,updated_at)
    VALUES (?,?,?,?,?,?,0,?,?)`).run(a.id, '2026-08-01', 2026, 'op', a.equipment_id, a.hours, now, now);
  for (const fid of a.fields) {
    db.prepare(`INSERT INTO field_activity_fields (id,activity_id,field_id,ha) VALUES (?,?,?,?)`)
      .run(`${a.id}-${fid}`, a.id, fid, null);
  }
}
function sharedInput(db, s) {
  db.prepare(`INSERT INTO shared_inputs (id,year,product,basis,rate_per_ha,is_establishment,created_at,updated_at)
    VALUES (?,?,?,?,?,0,?,?)`).run(s.id, 2026, 'Lime', 'per_ha_rate', s.rate_per_ha, now, now);
  for (const fid of s.fields) {
    db.prepare(`INSERT INTO shared_input_fields (id,shared_input_id,field_id) VALUES (?,?,?)`)
      .run(`${s.id}-${fid}`, s.id, fid);
  }
}
function price(db, enterprise, price_per_kg) {
  db.prepare(`INSERT INTO enterprise_prices (id,enterprise,year,price_per_kg,price_basis,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run(`${enterprise}-2026`, enterprise, 2026, price_per_kg, 'harvest_wet_kg', now, now);
}

describe('allEnterprisesSummary', () => {
  it('returns one row per productive enterprise with variable + loaded cost/kg', () => {
    const db = makeDb(); equip(db, 'm1');
    field(db, { id: 'r1' }); inputCost(db, 'r1', 10000); yieldKg(db, 'r1', 1000);
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['r1'] }); // +1336 loaded
    field(db, { id: 'o1', enterprise: 'oats' }); inputCost(db, 'o1', 5000); yieldKg(db, 'o1', 500);
    field(db, { id: 'fa', enterprise: 'fallow' }); // excluded
    price(db, 'rooibos', 60);
    const r = allEnterprisesSummary(db, 2026);
    const names = r.enterprises.map(e => e.enterprise);
    expect(names).toContain('rooibos');
    expect(names).toContain('oats');
    expect(names).not.toContain('fallow');
    const roo = r.enterprises.find(e => e.enterprise === 'rooibos');
    expect(roo.cost_per_kg_variable).toBe(10);     // 10000/1000
    expect(roo.cost_per_kg_loaded).toBe(11.34);    // 11336/1000
    expect(roo.price_per_kg).toBe(60);
    expect(roo.margin_per_kg).toBe(48.66);         // vs loaded
    expect(roo.yield_kg).toBe(1000);
    const oats = r.enterprises.find(e => e.enterprise === 'oats');
    expect(oats.cost_per_kg_loaded).toBe(10);
    expect(oats.price_per_kg).toBeNull();
    db.close();
  });
  it('degrades gracefully: no livestock tables data → flocks []', () => {
    const db = makeDb();
    field(db, { id: 'r1' }); inputCost(db, 'r1', 100);
    const r = allEnterprisesSummary(db, 2026);
    expect(Array.isArray(r.flocks)).toBe(true);
    db.close();
  });
});

describe('dataQuality', () => {
  it('flags uncategorized cost (spend outside any usage period)', () => {
    const db = makeDb();
    field(db, { id: 'r1', usageFrom: '2026-07-01' });        // usage starts July
    inputCost(db, 'r1', 4000, '2026-03-01');                  // spend in March → uncategorized
    const r = dataQuality(db, 2026);
    expect(r.uncategorized.total_zar).toBe(4000);
    expect(r.uncategorized.fields[0].field_id).toBe('r1');
    db.close();
  });
  it('flags costed fields with zero yield', () => {
    const db = makeDb();
    field(db, { id: 'r1' }); inputCost(db, 'r1', 9000);       // no yield row
    const r = dataQuality(db, 2026);
    expect(r.costed_no_yield.map(f => f.field_id)).toContain('r1');
    db.close();
  });
  it('counts off-but-data-exists layers and line warnings farm-wide', () => {
    const db = makeDb();
    field(db, { id: 'r1' }); inputCost(db, 'r1', 100);
    sharedInput(db, { id: 'si1', rate_per_ha: 500, fields: ['r1'] });
    const r = dataQuality(db, 2026);
    expect(r.excluded_layers.shared).toBe(1);
    expect(typeof r.warning_counts).toBe('object');
    expect(r.fields_scanned).toBeGreaterThan(0);
    db.close();
  });
});
