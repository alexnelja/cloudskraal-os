import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { todayUTC, CLOUDSKRAAL_TIMEZONE } from '../src/utils/dates.js';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';

describe('dates util', () => {
  it('todayUTC returns ISO YYYY-MM-DD', () => {
    const today = todayUTC();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today).toBe(new Date().toISOString().split('T')[0]);
  });

  it('CLOUDSKRAAL_TIMEZONE is Africa/Johannesburg', () => {
    expect(CLOUDSKRAAL_TIMEZONE).toBe('Africa/Johannesburg');
  });
});

describe('field_usage_period schema', () => {
  it('creates the table with expected columns', () => {
    const db = new Database(':memory:');
    initUsagePeriodsSchema(db);
    const cols = db.prepare("PRAGMA table_info(field_usage_period)").all();
    const names = cols.map(c => c.name).sort();
    expect(names).toEqual([
      'created_at', 'deleted_at', 'end_date', 'field_id', 'id',
      'notes', 'planted_date', 'rotation_year', 'source', 'start_date',
      'updated_at', 'usage',
    ]);
    db.close();
  });

  it('creates expected indexes', () => {
    const db = new Database(':memory:');
    initUsagePeriodsSchema(db);
    const idx = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='field_usage_period'"
    ).all().map(r => r.name);
    expect(idx).toContain('idx_fup_field_dates');
    expect(idx).toContain('idx_fup_active');
    db.close();
  });
});
