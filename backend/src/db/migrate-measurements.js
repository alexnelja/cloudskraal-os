function migrateMeasurements(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS measurements (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      kind        TEXT NOT NULL,
      value       REAL NOT NULL,
      unit        TEXT NOT NULL,
      formatted   TEXT NOT NULL,
      geometry    TEXT NOT NULL,
      field_id    TEXT NULL REFERENCES fields(id) ON DELETE SET NULL,
      notes       TEXT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_measurements_created ON measurements(created_at DESC);
  `);
}

module.exports = { migrateMeasurements };
