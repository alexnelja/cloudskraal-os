// Spec 2e.1 — Rooibos processing centre. Per-batch wet-in / dry-out weights give
// actual shrinkage (vs the default 0.45×0.87 factor) and capture processing cost.
// Stokke recirculation (the feedback loop) is deferred to 2e.2.
function initProcessingSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS processing_batches (
      id                 TEXT PRIMARY KEY,
      enterprise         TEXT NOT NULL DEFAULT 'rooibos',
      start_date         TEXT,
      end_date           TEXT,
      wet_in_kg          REAL,
      dried_bruto_kg     REAL,
      sifted_netto_kg    REAL,
      stokke_kg          REAL,
      stof_kg            REAL,
      stof_price_zar_per_kg REAL,
      processing_cost_zar REAL DEFAULT 0,
      status             TEXT DEFAULT 'done',
      notes              TEXT,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS processing_batch_sources (
      id                 TEXT PRIMARY KEY,
      batch_id           TEXT NOT NULL REFERENCES processing_batches(id) ON DELETE CASCADE,
      field_id           TEXT REFERENCES fields(id),
      period_id          TEXT,
      wet_contributed_kg REAL
    );
    CREATE INDEX IF NOT EXISTS idx_proc_sources_batch ON processing_batch_sources(batch_id);
    CREATE INDEX IF NOT EXISTS idx_proc_sources_field ON processing_batch_sources(field_id);
    CREATE INDEX IF NOT EXISTS idx_proc_batches_end ON processing_batches(end_date);

    -- 2e.2: stokke feedback loop. The recirculated stokke's wet weight was already
    -- counted in the source batch's wet_in, so it is NOT a field source here.
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

module.exports = { initProcessingSchema };
