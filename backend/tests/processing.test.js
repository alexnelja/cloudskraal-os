/**
 * Spec 2e.1 — Rooibos processing centre: batch-actual shrinkage + processing cost.
 * (Stokke recirculation deferred to 2e.2.)
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { initProcessingSchema } from '../src/db/schema-processing.js';
import { batchYield, fieldProcessingShare } from '../src/services/processing.js';
import { computeFieldCop } from '../src/services/cop.js';

function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);
  initProcessingSchema(db);
  return db;
}

function seedFields(db) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1', 'CK', 'CK', 'owned', now, now);
  for (const id of ['f1', 'f2']) {
    db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?)`).run(id, 'farm1', id, 'rooibos', 10, '{}', now, now);
  }
}

function seedBatch(db, b) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO processing_batches
    (id,enterprise,start_date,end_date,wet_in_kg,dried_bruto_kg,sifted_netto_kg,stokke_kg,stof_kg,
     stof_price_zar_per_kg,processing_cost_zar,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.id, b.enterprise ?? 'rooibos', b.start_date ?? '2026-02-01', b.end_date,
    b.wet_in_kg, b.dried_bruto_kg ?? null, b.sifted_netto_kg, b.stokke_kg ?? null, b.stof_kg ?? null,
    b.stof_price_zar_per_kg ?? null, b.processing_cost_zar ?? 0, b.status ?? 'done', now, now);
}

function seedRecirc(db, r) {
  db.prepare(`INSERT INTO processing_batch_recirculations (id,batch_id,source_batch_id,stokke_reintroduced_kg,created_at)
              VALUES (?,?,?,?,?)`).run(r.id, r.batch_id, r.source_batch_id ?? null, r.stokke_reintroduced_kg, new Date().toISOString());
}

function seedSource(db, s) {
  db.prepare(`INSERT INTO processing_batch_sources (id,batch_id,field_id,period_id,wet_contributed_kg)
              VALUES (?,?,?,?,?)`).run(s.id, s.batch_id, s.field_id, s.period_id ?? null, s.wet_contributed_kg);
}

describe('batchYield', () => {
  it('reports weights and actual shrinkage (sifted ÷ wet-in)', () => {
    const db = makeDb(); seedFields(db);
    seedBatch(db, { id: 'b1', end_date: '2026-03-01', wet_in_kg: 10000, dried_bruto_kg: 4500, sifted_netto_kg: 3900, stokke_kg: 450, stof_kg: 150 });
    const y = batchYield(db, 'b1');
    expect(y.wet_in).toBe(10000);
    expect(y.sifted_netto).toBe(3900);
    expect(y.shrinkage_actual).toBe(0.39);   // 3900 / 10000
    db.close();
  });
});

describe('fieldProcessingShare', () => {
  it('shares a batch by each field wet contribution', () => {
    const db = makeDb(); seedFields(db);
    seedBatch(db, { id: 'b1', end_date: '2026-03-01', wet_in_kg: 10000, sifted_netto_kg: 3900, processing_cost_zar: 5000 });
    seedSource(db, { id: 's1', batch_id: 'b1', field_id: 'f1', wet_contributed_kg: 6000 });
    seedSource(db, { id: 's2', batch_id: 'b1', field_id: 'f2', wet_contributed_kg: 4000 });

    const f1 = fieldProcessingShare(db, 'f1', 2026);
    expect(f1.sifted_netto_kg).toBe(2340);   // 0.6 × 3900
    expect(f1.processing_cost).toBe(3000);   // 0.6 × 5000
    expect(f1.batches).toHaveLength(1);
    expect(f1.batches[0]).toMatchObject({ batch_id: 'b1', share: 0.6 });

    const f2 = fieldProcessingShare(db, 'f2', 2026);
    expect(f2.sifted_netto_kg).toBe(1560);   // 0.4 × 3900
    expect(f2.processing_cost).toBe(2000);
    db.close();
  });

  it('attributes a batch to the year of its end_date', () => {
    const db = makeDb(); seedFields(db);
    seedBatch(db, { id: 'b1', end_date: '2027-01-10', wet_in_kg: 1000, sifted_netto_kg: 400, processing_cost_zar: 500 });
    seedSource(db, { id: 's1', batch_id: 'b1', field_id: 'f1', wet_contributed_kg: 1000 });
    expect(fieldProcessingShare(db, 'f1', 2026).batches).toHaveLength(0); // batch is 2027
    expect(fieldProcessingShare(db, 'f1', 2027).sifted_netto_kg).toBe(400);
    db.close();
  });

  it('sums multiple batches in the year', () => {
    const db = makeDb(); seedFields(db);
    seedBatch(db, { id: 'b1', end_date: '2026-03-01', wet_in_kg: 1000, sifted_netto_kg: 400, processing_cost_zar: 500 });
    seedBatch(db, { id: 'b2', end_date: '2026-06-01', wet_in_kg: 2000, sifted_netto_kg: 800, processing_cost_zar: 900 });
    seedSource(db, { id: 's1', batch_id: 'b1', field_id: 'f1', wet_contributed_kg: 1000 });
    seedSource(db, { id: 's2', batch_id: 'b2', field_id: 'f1', wet_contributed_kg: 2000 });
    const f1 = fieldProcessingShare(db, 'f1', 2026);
    expect(f1.sifted_netto_kg).toBe(1200);   // 400 + 800
    expect(f1.processing_cost).toBe(1400);   // 500 + 900
    db.close();
  });

  it('returns empty when the field fed no batches', () => {
    const db = makeDb(); seedFields(db);
    const r = fieldProcessingShare(db, 'f1', 2026);
    expect(r.sifted_netto_kg).toBe(0);
    expect(r.processing_cost).toBe(0);
    expect(r.batches).toEqual([]);
    db.close();
  });
});

describe('stokke recirculation + stof revenue (2e.2)', () => {
  it('batchYield reports fresh wet, recirculated-in, stof revenue, net cost, mass balance', () => {
    const db = makeDb(); seedFields(db);
    seedBatch(db, { id: 'b1', end_date: '2026-03-01', wet_in_kg: 11000, sifted_netto_kg: 4290,
      stof_kg: 150, stof_price_zar_per_kg: 2, processing_cost_zar: 5000 });
    seedSource(db, { id: 's1', batch_id: 'b1', field_id: 'f1', wet_contributed_kg: 6000 });
    seedSource(db, { id: 's2', batch_id: 'b1', field_id: 'f2', wet_contributed_kg: 4000 });
    seedRecirc(db, { id: 'rc1', batch_id: 'b1', source_batch_id: null, stokke_reintroduced_kg: 1000 });

    const y = batchYield(db, 'b1');
    expect(y.fresh_wet).toBe(10000);            // sum of sources
    expect(y.recirculated_in_kg).toBe(1000);
    expect(y.stof_revenue).toBe(300);           // 150 × 2
    expect(y.net_processing_cost).toBe(4700);   // 5000 − 300
    expect(y.mass_balance_ok).toBe(true);       // 11000 ≈ 10000 + 1000
    db.close();
  });

  it('shares by FRESH wet (recirculated wet not double-counted) and distributes net cost', () => {
    const db = makeDb(); seedFields(db);
    seedBatch(db, { id: 'b1', end_date: '2026-03-01', wet_in_kg: 11000, sifted_netto_kg: 4290,
      stof_kg: 150, stof_price_zar_per_kg: 2, processing_cost_zar: 5000 });
    seedSource(db, { id: 's1', batch_id: 'b1', field_id: 'f1', wet_contributed_kg: 6000 });
    seedSource(db, { id: 's2', batch_id: 'b1', field_id: 'f2', wet_contributed_kg: 4000 });
    seedRecirc(db, { id: 'rc1', batch_id: 'b1', stokke_reintroduced_kg: 1000 });

    const f1 = fieldProcessingShare(db, 'f1', 2026);   // share 6000/10000 = 0.6
    expect(f1.batches[0].share).toBe(0.6);
    expect(f1.sifted_netto_kg).toBe(2574);             // 0.6 × 4290
    expect(f1.processing_cost).toBe(2820);             // 0.6 × (5000 − 300 stof)
    db.close();
  });

  it('flags a mass-balance mismatch beyond tolerance', () => {
    const db = makeDb(); seedFields(db);
    seedBatch(db, { id: 'b1', end_date: '2026-03-01', wet_in_kg: 20000, sifted_netto_kg: 4000, processing_cost_zar: 0 });
    seedSource(db, { id: 's1', batch_id: 'b1', field_id: 'f1', wet_contributed_kg: 10000 });
    // wet_in 20000 but fresh 10000 + 0 recirc → big gap
    expect(batchYield(db, 'b1').mass_balance_ok).toBe(false);
    db.close();
  });
});

describe('computeFieldCop processing integration (opt-in)', () => {
  function copDb() {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initFarmSchema(db); initCalendarSchema(db); initPhase3Schema(db); migrateFieldCop(db);
    initUsagePeriodsSchema(db); initProcessingSchema(db);
    return db;
  }
  function seedRooibosField(db) {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .run('farm1', 'CK', 'CK', 'owned', now, now);
    db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?)`).run('f1', 'farm1', 'B12', 'rooibos', 21, '{}', now, now);
    db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?)`).run('f2', 'farm1', 'B13', 'rooibos', 14, '{}', now, now);
    db.prepare(`INSERT INTO field_usage_period (id,field_id,usage,start_date,end_date,source,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?)`).run('p1', 'f1', 'rooibos', '2026-01-01', '2026-12-31', 'seed', now, now);
    db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?)`).run('pr1', 'Fert', 'fertilizer', 'kg', 10, now, now);
    db.prepare(`INSERT INTO inventory_transactions
      (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run('t1', 'pr1', 'usage', '2026-03-01', 1, 100000, 100000, 'f1', 'direct_variable', now);
  }
  function seedBatchFor(db) {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO processing_batches
      (id,enterprise,start_date,end_date,wet_in_kg,sifted_netto_kg,processing_cost_zar,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run('b1', 'rooibos', '2026-02-01', '2026-03-01', 10000, 3900, 5000, 'done', now, now);
    db.prepare(`INSERT INTO processing_batch_sources (id,batch_id,field_id,wet_contributed_kg)
                VALUES (?,?,?,?)`).run('s1', 'b1', 'f1', 6000); // f1 6000 of 10000 fresh → share 0.6
    db.prepare(`INSERT INTO processing_batch_sources (id,batch_id,field_id,wet_contributed_kg)
                VALUES (?,?,?,?)`).run('s2', 'b1', 'f2', 4000);
  }

  it('does not attach processing by default (no regression)', () => {
    const db = copDb(); seedRooibosField(db); seedBatchFor(db);
    const line = computeFieldCop(db, 'f1', 2026).lines.find(l => l.usage === 'rooibos');
    expect(line.processing).toBeUndefined();
    expect(line.total_cost).toBe(100000);
    db.close();
  });

  it('attaches batch-actual processing cost + cost_per_netto_kg with include=processing', () => {
    const db = copDb(); seedRooibosField(db); seedBatchFor(db);
    const r = computeFieldCop(db, 'f1', 2026, { include: ['processing'] });
    const line = r.lines.find(l => l.usage === 'rooibos');
    expect(line.processing).toMatchObject({ processing_cost: 3000, sifted_netto_kg: 2340 });
    expect(line.cost_per_netto_kg_actual).toBe(44.02);  // (100000 + 3000) / 2340
    expect(r.coverage.batch_actuals_used).toHaveLength(1);
    db.close();
  });

  it('accepts include as a CSV string (from the API query)', () => {
    const db = copDb(); seedRooibosField(db); seedBatchFor(db);
    const line = computeFieldCop(db, 'f1', 2026, { include: 'processing' }).lines.find(l => l.usage === 'rooibos');
    expect(line.processing).toBeTruthy();
    db.close();
  });
});
