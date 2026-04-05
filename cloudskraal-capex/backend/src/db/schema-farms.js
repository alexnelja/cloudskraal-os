function initFarmSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      type TEXT NOT NULL DEFAULT 'owned',
      total_ha REAL,
      lat REAL,
      lng REAL,
      region TEXT,
      geometry TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fields (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL REFERENCES farms(id),
      name TEXT NOT NULL,
      code TEXT,
      enterprise TEXT NOT NULL DEFAULT 'unclassified',
      crop_type TEXT,
      area_ha REAL,
      planted_year TEXT,
      status TEXT DEFAULT 'active',
      geometry TEXT NOT NULL,
      soil_type TEXT,
      irrigation_type TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS field_production (
      id TEXT PRIMARY KEY,
      field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      estimated_yield_kg REAL,
      actual_yield_kg REAL,
      stand_pct REAL,
      notes TEXT,
      UNIQUE(field_id, year)
    );

    CREATE TABLE IF NOT EXISTS field_notes (
      id TEXT PRIMARY KEY,
      field_id TEXT REFERENCES fields(id) ON DELETE CASCADE,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      title TEXT,
      body TEXT,
      photo_path TEXT,
      tags TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS map_layers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_type TEXT NOT NULL,
      category TEXT,
      visible INTEGER DEFAULT 0,
      opacity REAL DEFAULT 0.7,
      z_index INTEGER DEFAULT 0
    );
  `);

  // Migration: add stand_pct column if it doesn't exist
  try {
    db.prepare('SELECT stand_pct FROM field_production LIMIT 1').get();
  } catch (e) {
    db.exec('ALTER TABLE field_production ADD COLUMN stand_pct REAL');
    console.log('  Migrated: added stand_pct to field_production');
  }
}

module.exports = { initFarmSchema };
