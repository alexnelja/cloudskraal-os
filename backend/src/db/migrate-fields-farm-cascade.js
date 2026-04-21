/**
 * Rebuild `fields` table to add ON DELETE CASCADE on farm_id.
 *
 * SQLite does not support ALTER TABLE ... ADD CONSTRAINT, so the
 * documented "12-step table alteration" dance is used:
 *   https://www.sqlite.org/lang_altertable.html#otheralter
 *
 * Important: `PRAGMA foreign_keys = OFF` has no effect inside a transaction
 * (SQLite ignores it while a transaction is open). So the pragma toggles
 * happen outside the txn, and the rebuild happens atomically inside it.
 */
function migrateFieldsFarmCascade(db) {
  const fkBefore = db.pragma('foreign_keys', { simple: true });

  // Must happen outside the transaction; otherwise SQLite ignores it.
  db.pragma('foreign_keys = OFF');

  try {
    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE fields_new (
          id TEXT PRIMARY KEY,
          farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          code TEXT,
          enterprise TEXT NOT NULL DEFAULT 'unclassified',
          crop_type TEXT,
          area_ha REAL,
          planted_year TEXT,
          status TEXT DEFAULT 'active',
          geometry TEXT,
          soil_type TEXT,
          irrigation_type TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      db.exec(`
        INSERT INTO fields_new
          SELECT id, farm_id, name, code, enterprise, crop_type, area_ha,
                 planted_year, status, geometry, soil_type, irrigation_type,
                 notes, created_at, updated_at
          FROM fields
      `);

      db.exec('DROP TABLE fields');
      db.exec('ALTER TABLE fields_new RENAME TO fields');

      // Re-create indexes that existed on the old table (see migrate-add-indexes.js).
      db.exec('CREATE INDEX IF NOT EXISTS idx_fields_farm_id ON fields(farm_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_fields_enterprise ON fields(enterprise)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_fields_farm_enterprise ON fields(farm_id, enterprise)');

      // SQLite FK-integrity check before committing — abort if something snuck in.
      const violations = db.pragma('foreign_key_check');
      if (violations.length > 0) {
        throw new Error(`foreign_key_check failed after fields rebuild: ${JSON.stringify(violations)}`);
      }
    });

    migrate();
  } finally {
    // Restore whatever the caller had configured. Schema.js turns FKs on at
    // boot, so this will typically restore `ON`.
    db.pragma(`foreign_keys = ${fkBefore ? 'ON' : 'OFF'}`);
  }
}

module.exports = { migrateFieldsFarmCascade };
