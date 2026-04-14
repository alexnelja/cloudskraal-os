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

import {
  USAGE_TYPES, PERENNIAL_USAGES,
  isValidUsage, isPerennial,
  assertNoOverlap, yearsSincePlanted, rotationYearEffective,
} from '../src/services/usage.js';

describe('usage service — enums', () => {
  it('USAGE_TYPES contains expected values', () => {
    expect(USAGE_TYPES).toEqual(expect.arrayContaining([
      'rooibos', 'lupines_fourrages', 'oats', 'fallow',
      'almond', 'grazing', 'vines', 'wheat',
    ]));
  });

  it('rejects unknown usage', () => {
    expect(isValidUsage('rooibos')).toBe(true);
    expect(isValidUsage('unicorns')).toBe(false);
  });

  it('identifies perennials', () => {
    expect(isPerennial('rooibos')).toBe(true);
    expect(isPerennial('almond')).toBe(true);
    expect(isPerennial('vines')).toBe(true);
    expect(isPerennial('oats')).toBe(false);
  });
});

describe('usage service — assertNoOverlap', () => {
  const base = { field_id: 'f1', start_date: '2026-01-01', end_date: '2026-12-31', deleted_at: null };

  it('allows adjacent (end === next start)', () => {
    const existing = [{ ...base, id: 'a' }];
    expect(() =>
      assertNoOverlap(existing, { field_id: 'f1', start_date: '2026-12-31', end_date: '2027-06-30' })
    ).not.toThrow();
  });

  it('throws on 1-day overlap', () => {
    const existing = [{ ...base, id: 'a' }];
    expect(() =>
      assertNoOverlap(existing, { field_id: 'f1', start_date: '2026-12-30', end_date: '2027-06-30' })
    ).toThrow(/overlap/i);
  });

  it('ignores overlaps for other fields', () => {
    const existing = [{ ...base, id: 'a' }];
    expect(() =>
      assertNoOverlap(existing, { field_id: 'f2', start_date: '2026-06-01', end_date: '2026-09-01' })
    ).not.toThrow();
  });

  it('ignores soft-deleted rows', () => {
    const existing = [{ ...base, id: 'a', deleted_at: '2026-05-01T00:00:00Z' }];
    expect(() =>
      assertNoOverlap(existing, { field_id: 'f1', start_date: '2026-06-01', end_date: '2026-09-01' })
    ).not.toThrow();
  });

  it('handles open-ended existing period (end_date null)', () => {
    const open = { ...base, end_date: null, id: 'a' };
    expect(() =>
      assertNoOverlap([open], { field_id: 'f1', start_date: '2027-01-01', end_date: '2027-12-31' })
    ).toThrow(/overlap/i);
  });

  it('handles both new and existing open-ended', () => {
    const open = { ...base, end_date: null, id: 'a' };
    expect(() =>
      assertNoOverlap([open], { field_id: 'f1', start_date: '2025-01-01', end_date: null })
    ).toThrow(/overlap/i);
  });
});

describe('usage service — derivations', () => {
  it('yearsSincePlanted', () => {
    expect(yearsSincePlanted('2022-07-01', '2026-04-14')).toBe(3);
    expect(yearsSincePlanted('2022-07-01', '2022-07-01')).toBe(0);
    expect(yearsSincePlanted(null, '2026-04-14')).toBeNull();
  });

  it('rotationYearEffective prefers stored', () => {
    expect(rotationYearEffective({ usage: 'lupines_fourrages', rotation_year: 2, planted_date: '2025-05-01' }, '2026-06-01')).toBe(2);
  });

  it('rotationYearEffective derives for perennial when not stored', () => {
    expect(rotationYearEffective({ usage: 'rooibos', rotation_year: null, planted_date: '2022-07-01' }, '2026-04-14')).toBe(3);
  });

  it('rotationYearEffective is null for non-perennial without stored value', () => {
    expect(rotationYearEffective({ usage: 'oats', rotation_year: null, planted_date: null }, '2026-04-14')).toBeNull();
  });
});
