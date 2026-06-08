/**
 * Spec 2f.3c — at-market transfer pricing. farm_config.transfer_pricing_mode
 * toggles between at_cost (default) and at_market; at_market uses per-event
 * market fields (grazing.market_value_zar, feeding.market_price_zar) with a
 * graceful fallback to at-cost + warning when the market figure is absent.
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { initPhase2Schema } from '../src/db/schema-phase2.js';
import { initFlockCopInputsSchema } from '../src/db/schema-flock-cop-inputs.js';
import { initGrazingEventsSchema } from '../src/db/schema-grazing-events.js';
import { initFeedingEventsSchema } from '../src/db/schema-feeding-events.js';
import { initFarmConfigSchema } from '../src/db/schema-farm-config.js';
import { computeFieldCop } from '../src/services/cop.js';
import { computeFlockCop } from '../src/services/livestock_cop.js';

function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db); initCalendarSchema(db); initPhase3Schema(db); migrateFieldCop(db);
  initUsagePeriodsSchema(db); initPhase2Schema(db); initFlockCopInputsSchema(db);
  initGrazingEventsSchema(db); initFeedingEventsSchema(db); initFarmConfigSchema(db);
  return db;
}

function seedField(db, { cost = 50000, yield_kg = 100000 } = {}) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1', 'CK', 'CK', 'owned', now, now);
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run('fld1', 'farm1', 'Lupines', 'lupines', 50, '{}', now, now);
  db.prepare(`INSERT INTO field_usage_period (id,field_id,usage,start_date,end_date,source,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run('p1', 'fld1', 'lupines', '2025-01-01', '2025-12-31', 'seed', now, now);
  db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run('prd1', 'Seed', 'seed', 'kg', 10, now, now);
  db.prepare(`INSERT INTO inventory_transactions
    (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run('tx1', 'prd1', 'usage', '2025-03-01', 1, cost, cost, 'fld1', 'direct_variable', now);
  db.prepare(`INSERT INTO field_production (id,field_id,year,actual_yield_kg,harvest_date)
              VALUES (?,?,?,?,?)`).run('fp1', 'fld1', 2025, yield_kg, '2025-05-01');
}

function seedFlock(db) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO livestock_groups (id,name,enterprise,species,head_count,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run('g1', 'Flock', 'sheep', 'sheep', 100, now, now);
  db.prepare(`INSERT INTO flock_cop_inputs
    (id,group_id,year,ewes_mated,greasy_fleece_kg_per_head,clean_yield_pct,liveweight_sold_kg_total,
     feed_cost,labour_cost,animal_health_cost,shearing_cost,other_direct_cost,wool_income,meat_income,source,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('i1', 'g1', 2025, 100, 5.0, 80, 10000, 0, 50000, 40000, 20000, 10000, 600000, 400000, 'actual', now, now);
}

function setMode(db, mode) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO farm_config (key,value,updated_at) VALUES ('transfer_pricing_mode',?,?)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(mode, now);
}

function addGrazing(db, { fraction = null, market_value_zar = null } = {}) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO grazing_events
    (id,group_id,field_id,start_date,end_date,allocation_fraction,market_value_zar,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run('ge1', 'g1', 'fld1', '2025-01-01', '2025-12-31', fraction, market_value_zar, now, now);
}

function addFeeding(db, { market_price_zar = null, qty = 10000 } = {}) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO feeding_events
    (id,group_id,date,source_type,source_field_id,source_usage,quantity_kg,market_price_zar,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run('fe1', 'g1', '2025-06-01', 'internal', 'fld1', 'lupines', qty, market_price_zar, now, now);
}

describe('at-market transfer pricing (2f.3c)', () => {
  it('default mode is at_cost (grazing uses field COP)', () => {
    const db = makeDb(); seedField(db); seedFlock(db);
    addGrazing(db, { fraction: 0.5 });
    expect(computeFlockCop(db, 'g1', 2025).transfers_in[0].amount).toBe(25000); // 50000 × 0.5
    db.close();
  });

  it('at_market grazing uses market_value_zar', () => {
    const db = makeDb(); seedField(db); seedFlock(db); setMode(db, 'at_market');
    addGrazing(db, { fraction: 0.5, market_value_zar: 12000 });
    expect(computeFlockCop(db, 'g1', 2025).transfers_in[0].amount).toBe(12000);
    db.close();
  });

  it('at_market grazing falls back to at-cost + warning when market value absent', () => {
    const db = makeDb(); seedField(db); seedFlock(db); setMode(db, 'at_market');
    addGrazing(db, { fraction: 0.5, market_value_zar: null });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.transfers_in[0].amount).toBe(25000);
    expect(r.warnings).toContain('market_value_missing');
    db.close();
  });

  it('at_market internal feed uses market_price_zar', () => {
    const db = makeDb(); seedField(db); seedFlock(db); setMode(db, 'at_market');
    addFeeding(db, { market_price_zar: 0.6, qty: 10000 });   // 6000 (vs at-cost 4500)
    expect(computeFlockCop(db, 'g1', 2025).transfers_in.find(t => t.kind === 'feed_internal').amount).toBe(6000);
    db.close();
  });

  it('at_market internal feed falls back to at-cost + warning when market price absent', () => {
    const db = makeDb(); seedField(db); seedFlock(db); setMode(db, 'at_market');
    addFeeding(db, { market_price_zar: null, qty: 10000 });  // at-cost 0.5 × 10000 = 5000
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.transfers_in.find(t => t.kind === 'feed_internal').amount).toBe(5000);
    expect(r.warnings).toContain('market_price_missing');
    db.close();
  });

  it('two legs still net to zero at market', () => {
    const db = makeDb(); seedField(db); seedFlock(db); setMode(db, 'at_market');
    addGrazing(db, { fraction: 0.5, market_value_zar: 12000 });
    const flock = computeFlockCop(db, 'g1', 2025);
    const field = computeFieldCop(db, 'fld1', 2025, { withTransfers: true });
    expect(flock.transfers_in[0].amount).toBe(field.internal_transfers.credit_total);
    db.close();
  });
});
