/**
 * Spec 2f.2 Slice A — computeFlockCop (basic flock COP, no transfers yet).
 *
 * Hybrid income-share allocation: shearing 100% → wool, rest split by gross-income share.
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initPhase2Schema } from '../src/db/schema-phase2.js';
import { initFlockCopInputsSchema } from '../src/db/schema-flock-cop-inputs.js';
import { computeFlockCop } from '../src/services/livestock_cop.js';

function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);
  initPhase2Schema(db);
  initFlockCopInputsSchema(db);
  return db;
}

function seedFlock(db, { id = 'g1', head_count = 100 } = {}) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO livestock_groups
    (id,name,enterprise,species,head_count,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run(id, 'Flock', 'sheep', 'sheep', head_count, now, now);
}

function seedInputs(db, overrides = {}) {
  const now = new Date().toISOString();
  const row = {
    id: 'i1', group_id: 'g1', year: 2025,
    ewes_mated: 100, weaning_pct: 130,
    greasy_fleece_kg_per_head: 5.0, clean_yield_pct: 80,
    liveweight_sold_kg_total: 10000,
    feed_cost: 100000, labour_cost: 50000, animal_health_cost: 40000,
    shearing_cost: 20000, other_direct_cost: 10000,
    wool_income: 600000, meat_income: 400000,
    source: 'actual', notes: null, created_at: now, updated_at: now,
    ...overrides,
  };
  db.prepare(`INSERT INTO flock_cop_inputs (
    id,group_id,year,ewes_mated,weaning_pct,greasy_fleece_kg_per_head,clean_yield_pct,
    liveweight_sold_kg_total,feed_cost,labour_cost,animal_health_cost,shearing_cost,
    other_direct_cost,wool_income,meat_income,source,notes,created_at,updated_at
  ) VALUES (
    @id,@group_id,@year,@ewes_mated,@weaning_pct,@greasy_fleece_kg_per_head,@clean_yield_pct,
    @liveweight_sold_kg_total,@feed_cost,@labour_cost,@animal_health_cost,@shearing_cost,
    @other_direct_cost,@wool_income,@meat_income,@source,@notes,@created_at,@updated_at
  )`).run(row);
}

describe('computeFlockCop — Slice A', () => {
  it('returns null when there is no COP input row for the year', () => {
    const db = makeDb();
    seedFlock(db);
    expect(computeFlockCop(db, 'g1', 2025)).toBeNull();
    db.close();
  });

  it('computes hybrid income-share allocation and per-kg COP (happy path)', () => {
    const db = makeDb();
    seedFlock(db, { head_count: 100 });
    seedInputs(db);

    const r = computeFlockCop(db, 'g1', 2025);

    expect(r.group_id).toBe('g1');
    expect(r.year).toBe(2025);
    expect(r.head_count).toBe(100);
    expect(r.costs.total).toBe(220000);          // 200000 shared + 20000 shearing
    expect(r.income.wool_share).toBe(0.6);       // 600000 / 1,000,000
    expect(r.allocation.wool).toBe(140000);      // 20000 shearing + 0.6 × 200000
    expect(r.allocation.meat).toBe(80000);       // 0.4 × 200000
    expect(r.denominators.clean_wool_kg).toBe(400);  // 5.0 × 100 × 0.80
    expect(r.cost_per_kg_wool).toBe(350);        // 140000 / 400
    expect(r.cost_per_kg_liveweight).toBe(8);    // 80000 / 10000
    expect(r.gross_margin).toBe(780000);         // 1,000,000 − 220,000
    expect(r.gross_margin_per_ewe).toBe(7800);   // 780000 / 100
    expect(r.transfers_in).toEqual([]);
    expect(r.warnings).toEqual([]);
    db.close();
  });

  it('puts 100% of shearing on wool (hybrid rule)', () => {
    const db = makeDb();
    seedFlock(db, { head_count: 100 });
    // zero shared pool so only shearing remains → all of it must land on wool
    seedInputs(db, {
      feed_cost: 0, labour_cost: 0, animal_health_cost: 0, other_direct_cost: 0,
      shearing_cost: 20000,
    });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.allocation.wool).toBe(20000);
    expect(r.allocation.meat).toBe(0);
    db.close();
  });

  it('skips allocation with a warning when there is no income to split by', () => {
    const db = makeDb();
    seedFlock(db);
    seedInputs(db, { wool_income: 0, meat_income: 0 });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.income.wool_share).toBeNull();
    expect(r.allocation.wool).toBeNull();
    expect(r.allocation.meat).toBeNull();
    expect(r.cost_per_kg_wool).toBeNull();
    expect(r.cost_per_kg_liveweight).toBeNull();
    expect(r.warnings).toContain('no_income_cannot_split');
    db.close();
  });

  it('nulls wool COP with a warning when a wool denominator input is missing', () => {
    const db = makeDb();
    seedFlock(db);
    seedInputs(db, { greasy_fleece_kg_per_head: null });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.denominators.clean_wool_kg).toBeNull();
    expect(r.cost_per_kg_wool).toBeNull();
    expect(r.warnings).toContain('wool_denominator_incomplete');
    // meat side still computes
    expect(r.cost_per_kg_liveweight).toBe(8);
    db.close();
  });

  it('nulls liveweight COP with a warning when nothing was sold', () => {
    const db = makeDb();
    seedFlock(db);
    seedInputs(db, { liveweight_sold_kg_total: 0 });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.cost_per_kg_liveweight).toBeNull();
    expect(r.warnings).toContain('no_liveweight_sold');
    db.close();
  });

  it('nulls gross_margin_per_ewe when ewes_mated is absent', () => {
    const db = makeDb();
    seedFlock(db);
    seedInputs(db, { ewes_mated: null });
    const r = computeFlockCop(db, 'g1', 2025);
    expect(r.gross_margin).toBe(780000);
    expect(r.gross_margin_per_ewe).toBeNull();
    db.close();
  });
});
