// v1.0.0 release gate — normalize production_batches.source_field_ids.
//
// The column stored a JSON-encoded array of field ids in a TEXT field with no
// referential integrity. This replaces it with a production_batch_source_fields
// junction table (FK to both production_batches and fields, cascade on delete),
// backfills any existing JSON data, then drops the denormalized column.
//
// Idempotent: safe to run on fresh DBs (where schema-phase2 already created the
// junction and omits the column) and on existing DBs (where it migrates).

function hasTable(db, table) {
  return !!db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
  ).get(table);
}

function hasCol(db, table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
}

function migrateNormalizeProductionSourceFields(db) {
  // 1. Junction table (no-op if schema-phase2 already created it on a fresh DB).
  db.exec(`
    CREATE TABLE IF NOT EXISTS production_batch_source_fields (
      batch_id TEXT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
      field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
      PRIMARY KEY (batch_id, field_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pbsf_field ON production_batch_source_fields(field_id);
  `);

  // 2. Backfill from the legacy JSON column, then drop it.
  if (hasCol(db, 'production_batches', 'source_field_ids')) {
    const validField = db.prepare('SELECT 1 FROM fields WHERE id = ?');
    const insertLink = db.prepare(
      'INSERT OR IGNORE INTO production_batch_source_fields (batch_id, field_id) VALUES (?, ?)'
    );
    const batches = db.prepare(
      'SELECT id, source_field_ids FROM production_batches WHERE source_field_ids IS NOT NULL'
    ).all();

    for (const b of batches) {
      let ids;
      try {
        ids = JSON.parse(b.source_field_ids);
      } catch {
        continue; // malformed legacy value — skip rather than crash the boot
      }
      if (!Array.isArray(ids)) continue;
      for (const fieldId of ids) {
        // FKs are ON during boot; only link fields that still exist.
        if (validField.get(fieldId)) insertLink.run(b.id, fieldId);
      }
    }

    db.exec('ALTER TABLE production_batches DROP COLUMN source_field_ids');
  }
}

module.exports = { migrateNormalizeProductionSourceFields };
