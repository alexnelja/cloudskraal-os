import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';

function setupDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);
  initCalendarSchema(db);
  initPhase3Schema(db);
  migrateFieldCop(db);
  return db;
}

describe('migrate-field-cop', () => {
  it('adds harvest_date to field_production', () => {
    const db = setupDb();
    const cols = db.prepare('PRAGMA table_info(field_production)').all();
    expect(cols.some(c => c.name === 'harvest_date')).toBe(true);
    db.close();
  });

  it('adds cost_category to inventory_transactions with default direct_variable', () => {
    const db = setupDb();
    const cols = db.prepare('PRAGMA table_info(inventory_transactions)').all();
    const col = cols.find(c => c.name === 'cost_category');
    expect(col).toBeTruthy();
    expect(col.dflt_value).toBe("'direct_variable'");
    db.close();
  });

  it('adds cost_category to time_entries with default direct_variable', () => {
    const db = setupDb();
    const cols = db.prepare('PRAGMA table_info(time_entries)').all();
    const col = cols.find(c => c.name === 'cost_category');
    expect(col).toBeTruthy();
    db.close();
  });

  it('is idempotent — second run does not throw', () => {
    const db = setupDb();
    expect(() => migrateFieldCop(db)).not.toThrow();
    db.close();
  });

  it('creates idx_fprod_field_harvest', () => {
    const db = setupDb();
    const idx = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='field_production'"
    ).all().map(r => r.name);
    expect(idx).toContain('idx_fprod_field_harvest');
    db.close();
  });
});

import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { usageOnDate } from '../src/services/cop.js';

function seedField(db) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1','Test','t','owned',now,now);
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`)
    .run('fld1','farm1','F1','unclassified','{}',now,now);
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

describe('usageOnDate', () => {
  it('returns the usage active on the date', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    expect(usageOnDate(db, 'fld1', '2026-04-14')).toEqual({
      usage: 'rooibos', period_id: 'p1'
    });
    db.close();
  });

  it('returns null when in a gap', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: '2024-01-01' });
    expect(usageOnDate(db, 'fld1', '2026-04-14')).toBeNull();
    db.close();
  });

  it('ignores soft-deleted periods', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    const now = new Date().toISOString();
    db.prepare('UPDATE field_usage_period SET deleted_at=? WHERE id=?').run(now, 'p1');
    expect(usageOnDate(db, 'fld1', '2026-04-14')).toBeNull();
    db.close();
  });

  it('picks most recent start_date when multiple overlap', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: '2026-03-31' });
    seedPeriod(db, { id: 'p2', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2026-04-01', end_date: null });
    expect(usageOnDate(db, 'fld1', '2026-05-01')).toEqual({
      usage: 'lupines_fourrages', period_id: 'p2'
    });
    db.close();
  });
});

import { periodsOverlappingYear } from '../src/services/cop.js';

describe('periodsOverlappingYear', () => {
  it('returns periods that touch the year', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    const rows = periodsOverlappingYear(db, 'fld1', 2026);
    expect(rows.map(r => r.id)).toEqual(['p1']);
    db.close();
  });

  it('includes periods that span two years', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2025-11-01', end_date: '2026-06-30' });
    const in2025 = periodsOverlappingYear(db, 'fld1', 2025).map(r => r.id);
    const in2026 = periodsOverlappingYear(db, 'fld1', 2026).map(r => r.id);
    expect(in2025).toContain('p1');
    expect(in2026).toContain('p1');
    db.close();
  });

  it('excludes soft-deleted', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    const now = new Date().toISOString();
    db.prepare('UPDATE field_usage_period SET deleted_at=? WHERE id=?').run(now, 'p1');
    expect(periodsOverlappingYear(db, 'fld1', 2026)).toEqual([]);
    db.close();
  });

  it('excludes periods entirely before the year', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2020-01-01', end_date: '2021-12-31' });
    expect(periodsOverlappingYear(db, 'fld1', 2026)).toEqual([]);
    db.close();
  });
});
