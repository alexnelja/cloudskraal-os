import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initAnnotationsSchema } from '../src/db/schema-annotations.js';

function seedDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);
  initAnnotationsSchema(db);
  return db;
}

describe('annotations schema', () => {
  it('creates the table with expected columns', () => {
    const db = seedDb();
    const cols = db.prepare('PRAGMA table_info(annotations)').all();
    const names = cols.map((c) => c.name).sort();
    expect(names).toEqual([
      'area_m2', 'created_at', 'farm_id', 'field_id', 'geometry_json',
      'id', 'length_m', 'notes', 'title', 'type', 'updated_at',
    ]);
    db.close();
  });

  it('creates expected indexes', () => {
    const db = seedDb();
    const idx = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='annotations'")
      .all()
      .map((r) => r.name);
    expect(idx).toContain('idx_annotations_type');
    expect(idx).toContain('idx_annotations_field_id');
    expect(idx).toContain('idx_annotations_created_at');
    db.close();
  });

  it('rejects invalid type via CHECK constraint', () => {
    const db = seedDb();
    expect(() =>
      db.prepare(`
        INSERT INTO annotations (id,type,title,geometry_json,created_at,updated_at)
        VALUES ('a','bogus','t','{}',datetime('now'),datetime('now'))
      `).run(),
    ).toThrow();
    db.close();
  });
});
