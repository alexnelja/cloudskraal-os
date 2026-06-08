/**
 * Spec 2f.1 — Livestock COP inputs (capture table + benchmark seed).
 *
 * Covers:
 *  - flock_cop_inputs schema: columns, UNIQUE(group_id, year), FK cascade
 *  - seedFlockCopInputs: benchmark rows per flock, labelled source, idempotent
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initPhase2Schema } from '../src/db/schema-phase2.js';
import { initFlockCopInputsSchema } from '../src/db/schema-flock-cop-inputs.js';
import { seedFlockCopInputs } from '../src/db/seed-flock-cop-inputs.js';

function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);        // livestock_groups FK-references fields(id)
  initPhase2Schema(db);
  initFlockCopInputsSchema(db);
  return db;
}

function seedFlocks(db) {
  const now = new Date().toISOString();
  const ins = db.prepare(`INSERT INTO livestock_groups
    (id,name,enterprise,species,breed,head_count,average_weight_kg,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  ins.run('g-be', 'Breeding Ewes 2025', 'sheep', 'sheep', 'merino', 450, 55, now, now);
  ins.run('g-tl', 'Trading Lambs 2025', 'sheep', 'sheep', 'merino', 120, 30, now, now);
  ins.run('g-ye', 'Young Ewes 2025', 'sheep', 'sheep', 'merino', 80, 42, now, now);
  ins.run('g-rr', 'Replacement Rams', 'sheep', 'sheep', 'merino', 15, 85, now, now);
}

describe('flock_cop_inputs schema', () => {
  it('creates the table with the key COP columns', () => {
    const db = makeDb();
    const cols = db.prepare('PRAGMA table_info(flock_cop_inputs)').all().map(c => c.name);
    for (const c of [
      'id', 'group_id', 'year', 'ewes_mated', 'weaning_pct',
      'greasy_fleece_kg_per_head', 'clean_yield_pct', 'liveweight_sold_kg_total',
      'feed_cost', 'labour_cost', 'animal_health_cost', 'shearing_cost',
      'other_direct_cost', 'wool_income', 'meat_income', 'source',
    ]) {
      expect(cols).toContain(c);
    }
    db.close();
  });

  it('enforces one row per (group_id, year)', () => {
    const db = makeDb();
    seedFlocks(db);
    const now = new Date().toISOString();
    const ins = db.prepare(`INSERT INTO flock_cop_inputs (id,group_id,year,created_at,updated_at)
                            VALUES (?,?,?,?,?)`);
    ins.run('r1', 'g-be', 2025, now, now);
    expect(() => ins.run('r2', 'g-be', 2025, now, now)).toThrow();
    // different year is fine
    expect(() => ins.run('r3', 'g-be', 2026, now, now)).not.toThrow();
    db.close();
  });

  it('cascades delete when the flock is removed', () => {
    const db = makeDb();
    seedFlocks(db);
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO flock_cop_inputs (id,group_id,year,created_at,updated_at)
                VALUES (?,?,?,?,?)`).run('r1', 'g-be', 2025, now, now);
    db.prepare('DELETE FROM livestock_groups WHERE id = ?').run('g-be');
    expect(db.prepare('SELECT COUNT(*) n FROM flock_cop_inputs').get().n).toBe(0);
    db.close();
  });

  it('is idempotent — second init does not throw', () => {
    const db = makeDb();
    expect(() => initFlockCopInputsSchema(db)).not.toThrow();
    db.close();
  });
});

describe('seedFlockCopInputs', () => {
  it('seeds a benchmark row per flock, labelled with provenance', () => {
    const db = makeDb();
    seedFlocks(db);
    seedFlockCopInputs(db);
    const rows = db.prepare('SELECT * FROM flock_cop_inputs').all();
    expect(rows.length).toBe(4);
    expect(rows.every(r => r.source === 'benchmark_landbank_2024_25')).toBe(true);
    db.close();
  });

  it('seeds the Breeding Ewes flock with the expected benchmark figures', () => {
    const db = makeDb();
    seedFlocks(db);
    seedFlockCopInputs(db);
    const be = db.prepare(`SELECT fci.* FROM flock_cop_inputs fci
      JOIN livestock_groups g ON g.id = fci.group_id
      WHERE g.name = 'Breeding Ewes 2025'`).get();
    expect(be.year).toBe(2025);
    expect(be.ewes_mated).toBe(450);
    expect(be.weaning_pct).toBe(130);
    expect(be.greasy_fleece_kg_per_head).toBe(5.5);
    expect(be.clean_yield_pct).toBe(68);
    expect(be.feed_cost).toBe(112500);
    expect(be.labour_cost).toBe(78300);
    expect(be.animal_health_cost).toBe(76500);
    expect(be.shearing_cost).toBe(6750);
    expect(be.wool_income).toBe(715500);
    expect(be.meat_income).toBe(645750);
    db.close();
  });

  it('gives non-breeding flocks no wool income (lambs) / no weaning, per class', () => {
    const db = makeDb();
    seedFlocks(db);
    seedFlockCopInputs(db);
    const lambs = db.prepare(`SELECT fci.* FROM flock_cop_inputs fci
      JOIN livestock_groups g ON g.id = fci.group_id
      WHERE g.name = 'Trading Lambs 2025'`).get();
    expect(lambs.wool_income).toBe(0);
    expect(lambs.weaning_pct).toBeNull();
    expect(lambs.meat_income).toBeGreaterThan(0);
    db.close();
  });

  it('is idempotent — does not double-seed', () => {
    const db = makeDb();
    seedFlocks(db);
    seedFlockCopInputs(db);
    seedFlockCopInputs(db);
    expect(db.prepare('SELECT COUNT(*) n FROM flock_cop_inputs').get().n).toBe(4);
    db.close();
  });
});
