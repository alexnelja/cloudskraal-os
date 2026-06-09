// Spec 2e.3 — adds the graded fine-fractions table to DBs created before it
// existed (init-processing-schema already applied on live DBs). Idempotent.
function migrateProcessingFractions(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS processing_batch_fractions (
      id               TEXT PRIMARY KEY,
      batch_id         TEXT NOT NULL REFERENCES processing_batches(id) ON DELETE CASCADE,
      grade            TEXT NOT NULL,
      kg               REAL,
      sold_kg          REAL DEFAULT 0,
      price_zar_per_kg REAL,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_proc_fractions_batch ON processing_batch_fractions(batch_id);
  `);
}

module.exports = { migrateProcessingFractions };
