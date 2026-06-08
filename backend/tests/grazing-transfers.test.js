/**
 * Spec 2f.2 Slice B — grazing_events + grazing-share + two-leg reconciliation.
 *
 *  - grazing_share = source field GROSS COP × allocation_fraction × year_overlap
 *  - flock leg (cost IN) and field leg (credit OUT) are equal → net zero
 *  - computeFieldCop transfers line is opt-in (default off, no regression)
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
  return db;
}

function seedFieldWithCost(db, { fieldId = 'fld1', cost = 50000, ssu_per_ha = null, area_ha = 50 } = {}) {
  const now = new Date().toISOString();
  if (!db.prepare("SELECT 1 FROM farms WHERE id='farm1'").get()) {
    db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .run('farm1', 'CK', 'CK', 'owned', now, now);
  }
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,ssu_per_ha,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(fieldId, 'farm1', 'Lupines', 'lupines', area_ha, ssu_per_ha, '{}', now, now);
  db.prepare(`INSERT INTO field_usage_period
    (id,field_id,usage,start_date,end_date,source,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run('p1', fieldId, 'lupines', '2025-01-01', '2025-12-31', 'seed', now, now);
  db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run('prod1', 'Seed', 'seed', 'kg', 10, now, now);
  db.prepare(`INSERT INTO inventory_transactions
    (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run('t1', 'prod1', 'usage', '2025-03-01', 1, cost, cost, fieldId, 'direct_variable', now);
}

function seedFlockAndInputs(db, { groupId = 'g1' } = {}) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO livestock_groups (id,name,enterprise,species,head_count,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run(groupId, 'Flock', 'sheep', 'sheep', 100, now, now);
  db.prepare(`INSERT INTO flock_cop_inputs
    (id,group_id,year,ewes_mated,greasy_fleece_kg_per_head,clean_yield_pct,liveweight_sold_kg_total,
     feed_cost,labour_cost,animal_health_cost,shearing_cost,other_direct_cost,wool_income,meat_income,
     source,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('i1', groupId, 2025, 100, 5.0, 80, 10000,
      100000, 50000, 40000, 20000, 10000, 600000, 400000, 'actual', now, now);
}

function addGrazing(db, { id = 'ge1', groupId = 'g1', fieldId = 'fld1', fraction = 0.5,
  head_count = null, start = '2025-01-01', end = '2025-12-31' } = {}) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO grazing_events
    (id,group_id,field_id,start_date,end_date,allocation_fraction,head_count,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id, groupId, fieldId, start, end, fraction, head_count, now, now);
}

describe('computeFieldCop transfers line (opt-in)', () => {
  it('does NOT add the transfers line by default (regression-safe)', () => {
    const db = makeDb();
    seedFieldWithCost(db);
    const r = computeFieldCop(db, 'fld1', 2025);
    expect(r.internal_transfers).toBeUndefined();
    expect(r.totals.total_cost).toBe(50000);
    db.close();
  });

  it('adds an internal_transfers credit line when withTransfers is set', () => {
    const db = makeDb();
    seedFieldWithCost(db);
    seedFlockAndInputs(db);
    addGrazing(db, { fraction: 0.5 });   // 50000 × 0.5 = 25000 credit out
    const r = computeFieldCop(db, 'fld1', 2025, { withTransfers: true });
    expect(r.internal_transfers.credit_total).toBe(25000);
    expect(r.internal_transfers.items).toHaveLength(1);
    expect(r.internal_transfers.items[0]).toMatchObject({ flock_id: 'g1', kind: 'grazing', amount: 25000 });
    expect(r.totals.net_cost_after_transfers).toBe(25000);  // 50000 − 25000
    db.close();
  });
});

describe('computeFlockCop grazing-share (Slice B)', () => {
  it('folds grazing-share into the shared pool and lists it in transfers_in', () => {
    const db = makeDb();
    seedFieldWithCost(db, { cost: 50000 });
    seedFlockAndInputs(db);
    addGrazing(db, { fraction: 0.5 });   // grazing_share = 25000

    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.transfers_in).toHaveLength(1);
    expect(r.transfers_in[0]).toMatchObject({ source_field_id: 'fld1', kind: 'grazing', amount: 25000 });
    // shared pool was 200000; +25000 grazing = 225000; ×0.6 wool share + 20000 shearing
    expect(r.allocation.wool).toBe(20000 + 0.6 * 225000);   // 155000
    expect(r.allocation.meat).toBe(0.4 * 225000);           // 90000
    expect(r.costs.total).toBe(20000 + 225000);             // 245000 incl. transfer
    db.close();
  });

  it('reconciles two legs to net zero (flock cost IN == field credit OUT)', () => {
    const db = makeDb();
    seedFieldWithCost(db, { cost: 50000 });
    seedFlockAndInputs(db);
    addGrazing(db, { fraction: 0.4 });

    const flock = computeFlockCop(db, 'g1', 2025);
    const field = computeFieldCop(db, 'fld1', 2025, { withTransfers: true });
    const inAmount = flock.transfers_in[0].amount;
    const outAmount = field.internal_transfers.credit_total;
    expect(inAmount).toBe(outAmount);                       // 50000 × 0.4 = 20000 both sides
    db.close();
  });

  it('sums multiple grazing events', () => {
    const db = makeDb();
    seedFieldWithCost(db, { cost: 50000 });
    seedFlockAndInputs(db);
    addGrazing(db, { id: 'ge1', fraction: 0.3 });
    addGrazing(db, { id: 'ge2', fraction: 0.2 });
    const r = computeFlockCop(db, 'g1', 2025);
    const total = r.transfers_in.reduce((s, t) => s + t.amount, 0);
    expect(total).toBe(50000 * 0.5);                        // 25000
    db.close();
  });

  it('grazing-share = 0 with a warning when the event has no costable source field', () => {
    const db = makeDb();
    seedFlockAndInputs(db);
    addGrazing(db, { fieldId: null, fraction: 0.5 });       // unlinked event → no field COP
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.transfers_in[0].amount).toBe(0);
    expect(r.warnings).toContain('source_field_not_found');
    db.close();
  });

  it('auto-allocates from stocking density when allocation_fraction is null (2f.3d)', () => {
    const db = makeDb();
    seedFieldWithCost(db, { cost: 50000, area_ha: 50, ssu_per_ha: 2 });   // capacity 100 SSU
    seedFlockAndInputs(db);
    // 50 head full year → animal-days 50×365; capacity-days 100×365 → fraction 0.5
    addGrazing(db, { fraction: null, head_count: 50, start: '2025-01-01', end: '2025-12-31' });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.transfers_in[0].amount).toBe(25000);   // 50000 × 0.5
    db.close();
  });

  it('warns field_capacity_missing when auto-allocation lacks ssu_per_ha', () => {
    const db = makeDb();
    seedFieldWithCost(db, { cost: 50000, ssu_per_ha: null });
    seedFlockAndInputs(db);
    addGrazing(db, { fraction: null, head_count: 50 });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.transfers_in[0].amount).toBe(0);
    expect(r.warnings).toContain('field_capacity_missing');
    db.close();
  });

  it('warns grazing_allocation_unspecified when neither fraction nor head_count given', () => {
    const db = makeDb();
    seedFieldWithCost(db, { cost: 50000, ssu_per_ha: 2 });
    seedFlockAndInputs(db);
    addGrazing(db, { fraction: null, head_count: null });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.transfers_in[0].amount).toBe(0);
    expect(r.warnings).toContain('grazing_allocation_unspecified');
    db.close();
  });

  it('manual fraction still takes precedence over head_count', () => {
    const db = makeDb();
    seedFieldWithCost(db, { cost: 50000, ssu_per_ha: 2 });
    seedFlockAndInputs(db);
    addGrazing(db, { fraction: 0.4, head_count: 50 });   // fraction wins
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.transfers_in[0].amount).toBe(20000);   // 50000 × 0.4
    db.close();
  });

  it('tags each transfer with the source field enterprise (2f.3e)', () => {
    const db = makeDb();
    seedFieldWithCost(db, { cost: 50000 });   // field enterprise = 'lupines'
    seedFlockAndInputs(db);
    addGrazing(db, { fraction: 0.5 });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.transfers_in[0].source_enterprise).toBe('lupines');
    db.close();
  });

  it('pro-rates an event that straddles the year boundary', () => {
    const db = makeDb();
    seedFieldWithCost(db, { cost: 50000 });
    seedFlockAndInputs(db);
    // 100-day event, 31 days (Dec 1–31) inside 2025 → factor 31/100
    addGrazing(db, { fraction: 1.0, start: '2025-12-01', end: '2026-03-10' });
    const r = computeFlockCop(db, 'g1', 2025);
    // 50000 × 1.0 × (31/100) = 15500
    expect(r.transfers_in[0].amount).toBe(15500);
    db.close();
  });
});
