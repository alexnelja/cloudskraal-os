import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initAnnotationsSchema } from '../src/db/schema-annotations.js';
import { migrateAnnotationsCategory } from '../src/db/migrate-annotations-category.js';
import {
  createAnnotation,
  listAnnotations,
  getAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from '../src/services/annotations.js';

function setup() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);
  initAnnotationsSchema(db);
  migrateAnnotationsCategory(db);
  // Seed one farm + one field that contains the point (0.5, 0.5).
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO farms (id, name, total_ha, created_at, updated_at)
    VALUES (?,?,?,?,?)
  `).run('farm-1', 'Test farm', 100, now, now);
  db.prepare(`
    INSERT INTO fields (id, farm_id, name, enterprise, geometry, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?)
  `).run(
    'field-A', 'farm-1', 'A', 'other',
    JSON.stringify({
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    }),
    now, now,
  );
  return db;
}

const linePin = {
  type: 'line',
  title: 'Fence',
  geometry: { type: 'LineString', coordinates: [[0.1, 0.5], [0.9, 0.5]] },
};

describe('annotations service', () => {
  let db;
  beforeEach(() => { db = setup(); });

  it('create returns a row with computed length_m and resolved field_id', () => {
    const row = createAnnotation(db, linePin);
    expect(row.id).toBeTruthy();
    expect(row.type).toBe('line');
    expect(row.title).toBe('Fence');
    expect(row.length_m).toBeGreaterThan(0);
    expect(row.area_m2).toBeNull();
    expect(row.field_id).toBe('field-A');
    expect(row.farm_id).toBe('farm-1');
  });

  it('create with polygon computes area_m2', () => {
    const row = createAnnotation(db, {
      type: 'polygon',
      title: 'Patch',
      geometry: {
        type: 'Polygon',
        coordinates: [[[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4], [0.2, 0.2]]],
      },
    });
    expect(row.area_m2).toBeGreaterThan(0);
    expect(row.length_m).toBeNull();
  });

  it('create with pin has no metrics but resolves field', () => {
    const row = createAnnotation(db, {
      type: 'pin',
      title: 'Gate',
      geometry: { type: 'Point', coordinates: [0.5, 0.5] },
    });
    expect(row.length_m).toBeNull();
    expect(row.area_m2).toBeNull();
    expect(row.field_id).toBe('field-A');
  });

  it('create throws on type/geometry mismatch', () => {
    expect(() =>
      createAnnotation(db, {
        type: 'line',
        title: 'wrong',
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }),
    ).toThrow(/mismatch/i);
  });

  it('list returns all rows, newest first', () => {
    createAnnotation(db, linePin);
    createAnnotation(db, { ...linePin, title: 'Second' });
    const rows = listAnnotations(db);
    expect(rows.length).toBe(2);
    expect(rows[0].title).toBe('Second');
  });

  it('list filters by type', () => {
    createAnnotation(db, linePin);
    createAnnotation(db, {
      type: 'pin',
      title: 'Gate',
      geometry: { type: 'Point', coordinates: [0.5, 0.5] },
    });
    const pins = listAnnotations(db, { type: 'pin' });
    expect(pins.length).toBe(1);
    expect(pins[0].type).toBe('pin');
  });

  it('get returns a single row', () => {
    const { id } = createAnnotation(db, linePin);
    const row = getAnnotation(db, id);
    expect(row.id).toBe(id);
  });

  it('update changes title and notes only, preserves geometry + metrics', () => {
    const row = createAnnotation(db, linePin);
    const originalLen = row.length_m;
    const originalGeom = row.geometry_json;
    const updated = updateAnnotation(db, row.id, { title: 'Renamed', notes: 'hello' });
    expect(updated.title).toBe('Renamed');
    expect(updated.notes).toBe('hello');
    expect(updated.length_m).toBe(originalLen);
    expect(updated.geometry_json).toBe(originalGeom);
  });

  it('update returns null when not found', () => {
    expect(updateAnnotation(db, 'missing', { title: 'x' })).toBeNull();
  });

  it('delete removes the row', () => {
    const { id } = createAnnotation(db, linePin);
    expect(deleteAnnotation(db, id)).toBe(true);
    expect(getAnnotation(db, id)).toBeNull();
  });

  it('delete returns false when not found', () => {
    expect(deleteAnnotation(db, 'missing')).toBe(false);
  });

  it('create with a valid category persists it', () => {
    const row = createAnnotation(db, {
      type: 'pin',
      title: 'Pump 1',
      category: 'pump',
      geometry: { type: 'Point', coordinates: [0.5, 0.5] },
    });
    expect(row.category).toBe('pump');
  });

  it('create with an invalid category throws invalid_category', () => {
    expect(() =>
      createAnnotation(db, {
        type: 'pin',
        title: 'Bad',
        category: 'dam',
        geometry: { type: 'Point', coordinates: [0.5, 0.5] },
      }),
    ).toThrow(/invalid_category/);
  });

  it('update can set and clear category', () => {
    const row = createAnnotation(db, {
      type: 'pin',
      title: 'Pump',
      geometry: { type: 'Point', coordinates: [0.5, 0.5] },
    });
    const updated = updateAnnotation(db, row.id, { category: 'pump' });
    expect(updated.category).toBe('pump');
    const cleared = updateAnnotation(db, row.id, { category: null });
    expect(cleared.category).toBeNull();
  });

  it('create stores metadata_json when provided', () => {
    const row = createAnnotation(db, {
      type: 'pin',
      title: 'Pump',
      category: 'pump',
      metadata: { flow_lps: 12, installed: '2025-03' },
      geometry: { type: 'Point', coordinates: [0.5, 0.5] },
    });
    expect(row.metadata).toEqual({ flow_lps: 12, installed: '2025-03' });
  });
});
