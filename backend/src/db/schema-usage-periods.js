function initUsagePeriodsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS field_usage_period (
      id            TEXT PRIMARY KEY,
      field_id      TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
      usage         TEXT NOT NULL,
      start_date    TEXT NOT NULL,
      end_date      TEXT,
      planted_date  TEXT,
      rotation_year INTEGER,
      source        TEXT NOT NULL,
      notes         TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      deleted_at    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fup_field_dates
      ON field_usage_period(field_id, start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_fup_active
      ON field_usage_period(field_id) WHERE end_date IS NULL AND deleted_at IS NULL;
  `);
}

module.exports = { initUsagePeriodsSchema };
