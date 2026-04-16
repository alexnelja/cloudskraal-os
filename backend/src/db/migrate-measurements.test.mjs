import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const { migrateMeasurements } = require('./migrate-measurements');

describe('migrateMeasurements', () => {
  it('creates the measurements table with expected columns', () => {
    const db = new Database(':memory:');
    migrateMeasurements(db);
    const cols = db.prepare("PRAGMA table_info(measurements)").all().map(c => c.name);
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'name', 'kind', 'value', 'unit', 'formatted', 'geometry', 'field_id', 'notes', 'created_at'])
    );
  });

  it('is idempotent — running twice does not error', () => {
    const db = new Database(':memory:');
    migrateMeasurements(db);
    expect(() => migrateMeasurements(db)).not.toThrow();
  });
});
