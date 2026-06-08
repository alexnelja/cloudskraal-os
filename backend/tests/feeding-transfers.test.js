/**
 * Spec 2f.2 Slice C — feeding_events: purchased vs internal-at-cost + bucket override.
 *
 *  - purchased feed → flock shared pool; if any purchased events exist they OVERRIDE
 *    the annual feed_cost bucket (warning feed_bucket_overridden_by_events)
 *  - internal feed → at cost = qty × source field line cost_per_kg; two-leg net zero
 *  - source_usage line resolution + graceful fallbacks
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
import { computeFieldCop } from '../src/services/cop.js';
import { computeFlockCop } from '../src/services/livestock_cop.js';

function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);
  initCalendarSchema(db);
  initPhase3Schema(db);
  migrateFieldCop(db);
  initUsagePeriodsSchema(db);
  initPhase2Schema(db);
  initFlockCopInputsSchema(db);
  initGrazingEventsSchema(db);
  initFeedingEventsSchema(db);
  return db;
}

// Field that yields a known cost_per_kg = cost / yield on its 'lupines' line.
function seedField(db, { fieldId = 'fld1', cost = 45000, yield_kg = 100000, withYield = true } = {}) {
  const now = new Date().toISOString();
  if (!db.prepare("SELECT 1 FROM farms WHERE id='farm1'").get()) {
    db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .run('farm1', 'CK', 'CK', 'owned', now, now);
  }
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(fieldId, 'farm1', 'Lupines', 'lupines', 50, '{}', now, now);
  db.prepare(`INSERT INTO field_usage_period
    (id,field_id,usage,start_date,end_date,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run('p_' + fieldId, fieldId, 'lupines', '2025-01-01', '2025-12-31', 'seed', now, now);
  db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run('prd_' + fieldId, 'Seed', 'seed', 'kg', 10, now, now);
  db.prepare(`INSERT INTO inventory_transactions
    (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run('tx_' + fieldId, 'prd_' + fieldId, 'usage', '2025-03-01', 1, cost, cost, fieldId, 'direct_variable', now);
  if (withYield) {
    db.prepare(`INSERT INTO field_production (id,field_id,year,actual_yield_kg,harvest_date)
                VALUES (?,?,?,?,?)`).run('fp_' + fieldId, fieldId, 2025, yield_kg, '2025-05-01');
  }
}

function seedFlock(db, { feed_cost = 100000 } = {}) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO livestock_groups (id,name,enterprise,species,head_count,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run('g1', 'Flock', 'sheep', 'sheep', 100, now, now);
  db.prepare(`INSERT INTO flock_cop_inputs
    (id,group_id,year,ewes_mated,greasy_fleece_kg_per_head,clean_yield_pct,liveweight_sold_kg_total,
     feed_cost,labour_cost,animal_health_cost,shearing_cost,other_direct_cost,wool_income,meat_income,
     source,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('i1', 'g1', 2025, 100, 5.0, 80, 10000,
      feed_cost, 50000, 40000, 20000, 10000, 600000, 400000, 'actual', now, now);
}

function addFeeding(db, e) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO feeding_events
    (id,group_id,date,source_type,source_field_id,source_usage,product,quantity_kg,unit_cost_zar,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    e.id, 'g1', e.date || '2025-06-01', e.source_type, e.source_field_id ?? null,
    e.source_usage ?? null, e.product ?? 'feed', e.quantity_kg ?? null, e.unit_cost_zar ?? null, now, now);
}

describe('feeding_events — purchased', () => {
  it('overrides the annual feed bucket when purchased events exist', () => {
    const db = makeDb();
    seedFlock(db, { feed_cost: 100000 });
    addFeeding(db, { id: 'f1', source_type: 'purchased', quantity_kg: 1000, unit_cost_zar: 30 }); // 30000
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.costs.feed).toBe(30000);                  // itemised wins over the 100000 bucket
    expect(r.warnings).toContain('feed_bucket_overridden_by_events');
    // shared pool = 30000 feed + 50000 + 40000 + 10000 = 130000
    expect(r.costs.total).toBe(20000 + 130000);        // 150000 incl. shearing
    db.close();
  });

  it('uses the annual bucket when there are no purchased events', () => {
    const db = makeDb();
    seedFlock(db, { feed_cost: 100000 });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.costs.feed).toBe(100000);
    expect(r.warnings).not.toContain('feed_bucket_overridden_by_events');
    db.close();
  });
});

describe('feeding_events — internal (at cost)', () => {
  it('values internal feed at the source field line cost_per_kg and reconciles two legs', () => {
    const db = makeDb();
    seedField(db, { fieldId: 'fld1', cost: 45000, yield_kg: 100000 });  // cost_per_kg = 0.45
    seedFlock(db, { feed_cost: 0 });
    addFeeding(db, {
      id: 'f1', source_type: 'internal', source_field_id: 'fld1',
      source_usage: 'lupines', quantity_kg: 10000,
    }); // 10000 × 0.45 = 4500

    const flock = computeFlockCop(db, 'g1', 2025);
    const fed = flock.transfers_in.find(t => t.kind === 'feed_internal');
    expect(fed.amount).toBe(4500);

    const field = computeFieldCop(db, 'fld1', 2025, { withTransfers: true });
    const credit = field.internal_transfers.items.find(i => i.kind === 'feed_internal');
    expect(credit.amount).toBe(4500);                  // two legs equal → net zero
    db.close();
  });

  it('falls back to field total cost/yield when source_usage does not match a line', () => {
    const db = makeDb();
    seedField(db, { fieldId: 'fld1', cost: 45000, yield_kg: 100000 });
    seedFlock(db, { feed_cost: 0 });
    addFeeding(db, {
      id: 'f1', source_type: 'internal', source_field_id: 'fld1',
      source_usage: 'nonexistent_usage', quantity_kg: 10000,
    });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.warnings).toContain('feed_product_line_ambiguous');
    expect(r.transfers_in.find(t => t.kind === 'feed_internal').amount).toBe(4500); // 45000/100000 × 10000
    db.close();
  });

  it('costs internal feed at 0 with a warning when the source line has no yield', () => {
    const db = makeDb();
    seedField(db, { fieldId: 'fld1', cost: 45000, withYield: false });  // cost but no yield → cost_per_kg null
    seedFlock(db, { feed_cost: 0 });
    addFeeding(db, {
      id: 'f1', source_type: 'internal', source_field_id: 'fld1',
      source_usage: 'lupines', quantity_kg: 10000,
    });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.transfers_in.find(t => t.kind === 'feed_internal').amount).toBe(0);
    expect(r.warnings).toContain('internal_feed_uncosted');
    db.close();
  });
});
