// Spec 2e.2 — adds stof_price_zar_per_kg + the recirculations table to DBs that
// ran init-processing-schema before they existed. Idempotent.
function migrateProcessingRecirculation(db) {
  const hasStofPrice = db.prepare('PRAGMA table_info(processing_batches)')
    .all().some(c => c.name === 'stof_price_zar_per_kg');
  if (!hasStofPrice) {
    db.exec('ALTER TABLE processing_batches ADD COLUMN stof_price_zar_per_kg REAL');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS processing_batch_recirculations (
      id                    TEXT PRIMARY KEY,
      batch_id              TEXT NOT NULL REFERENCES processing_batches(id) ON DELETE CASCADE,
      source_batch_id       TEXT REFERENCES processing_batches(id),
      stokke_reintroduced_kg REAL,
      created_at            TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_proc_recirc_batch ON processing_batch_recirculations(batch_id);
  `);
}

module.exports = { migrateProcessingRecirculation };
