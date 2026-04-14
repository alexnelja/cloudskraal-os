function initConversionFactorsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversion_factors (
      id             TEXT PRIMARY KEY,
      from_uom       TEXT NOT NULL,
      to_uom         TEXT NOT NULL,
      context        TEXT NOT NULL,
      factor         REAL NOT NULL,
      effective_from TEXT NOT NULL,
      notes          TEXT,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_factors_lookup
      ON conversion_factors(from_uom, to_uom, context, effective_from);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_factors_unique
      ON conversion_factors(from_uom, to_uom, context, effective_from);
  `);
}

module.exports = { initConversionFactorsSchema };
