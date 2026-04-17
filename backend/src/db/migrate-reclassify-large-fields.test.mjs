import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const { migrateReclassifyLargeFields, AREA_THRESHOLD_HA } = require('./migrate-reclassify-large-fields');

/** Minimal fields table matching the production schema. */
function createFieldsTable(db) {
  db.exec(`
    CREATE TABLE farms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    INSERT INTO farms VALUES ('farm1', 'TestFarm');

    CREATE TABLE fields (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL REFERENCES farms(id),
      name TEXT NOT NULL,
      enterprise TEXT NOT NULL DEFAULT 'unclassified',
      area_ha REAL,
      geometry TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function insertField(db, { id, name, enterprise, area_ha }) {
  db.prepare(`
    INSERT INTO fields (id, farm_id, name, enterprise, area_ha, geometry, created_at, updated_at)
    VALUES (?, 'farm1', ?, ?, ?, '{}', datetime('now'), datetime('now'))
  `).run(id, name, enterprise, area_ha);
}

describe('migrateReclassifyLargeFields', () => {
  it('reclassifies fields >= 100 ha as farm_boundary', () => {
    const db = new Database(':memory:');
    createFieldsTable(db);
    insertField(db, { id: '1', name: 'BigField', enterprise: 'rooibos', area_ha: 324.76 });
    insertField(db, { id: '2', name: 'SmallField', enterprise: 'rooibos', area_ha: 50 });

    const changes = migrateReclassifyLargeFields(db);

    expect(changes).toBe(1);
    const big = db.prepare('SELECT enterprise FROM fields WHERE id = ?').get('1');
    const small = db.prepare('SELECT enterprise FROM fields WHERE id = ?').get('2');
    expect(big.enterprise).toBe('farm_boundary');
    expect(small.enterprise).toBe('rooibos');
  });

  it('does not touch fields already marked farm_boundary', () => {
    const db = new Database(':memory:');
    createFieldsTable(db);
    insertField(db, { id: '1', name: 'AlreadyDone', enterprise: 'farm_boundary', area_ha: 200 });

    const changes = migrateReclassifyLargeFields(db);
    expect(changes).toBe(0);
  });

  it('is idempotent — running twice does not error and second run changes nothing', () => {
    const db = new Database(':memory:');
    createFieldsTable(db);
    insertField(db, { id: '1', name: 'BigField', enterprise: 'rooibos', area_ha: 150 });

    migrateReclassifyLargeFields(db);
    const changes = migrateReclassifyLargeFields(db);
    expect(changes).toBe(0);

    const row = db.prepare('SELECT enterprise FROM fields WHERE id = ?').get('1');
    expect(row.enterprise).toBe('farm_boundary');
  });

  it('reclassifies all four known oversized fields when present', () => {
    const db = new Database(':memory:');
    createFieldsTable(db);

    const largeFields = [
      { id: 'a', name: 'Kromvlei', enterprise: 'rooibos', area_ha: 324.76 },
      { id: 'b', name: 'Pierre Claudskraal 645', enterprise: 'rooibos', area_ha: 244.28 },
      { id: 'c', name: 'Kromvlei Driehoek', enterprise: 'rooibos', area_ha: 165.45 },
      { id: 'd', name: 'Kromvlei Rooibos', enterprise: 'rooibos', area_ha: 144.14 },
      { id: 'e', name: 'Normal Field', enterprise: 'rooibos', area_ha: 68 },
    ];
    for (const f of largeFields) insertField(db, f);

    const changes = migrateReclassifyLargeFields(db);
    expect(changes).toBe(4);

    const boundaries = db.prepare(
      "SELECT name FROM fields WHERE enterprise = 'farm_boundary' ORDER BY area_ha DESC"
    ).all().map(r => r.name);
    expect(boundaries).toEqual([
      'Kromvlei',
      'Pierre Claudskraal 645',
      'Kromvlei Driehoek',
      'Kromvlei Rooibos',
    ]);
  });

  it('uses 100 as the threshold constant', () => {
    expect(AREA_THRESHOLD_HA).toBe(100);
  });
});
