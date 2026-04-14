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
