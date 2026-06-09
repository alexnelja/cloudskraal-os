// Spec 2c/2d — long-horizon costs: capital amortization + overhead allocation.
function initLongHorizonSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS field_establishment (
      id                       TEXT PRIMARY KEY,
      field_id                 TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
      usage                    TEXT,
      planted_date             TEXT,
      total_cost_zar           REAL,
      expected_productive_years INTEGER,
      notes                    TEXT,
      created_at               TEXT NOT NULL,
      updated_at               TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_establishment_field ON field_establishment(field_id);

    CREATE TABLE IF NOT EXISTS overhead_entries (
      id          TEXT PRIMARY KEY,
      year        INTEGER NOT NULL,
      category    TEXT NOT NULL,
      amount_zar  REAL NOT NULL,
      notes       TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_overhead_entries_year ON overhead_entries(year);

    CREATE TABLE IF NOT EXISTS overhead_allocation_rules (
      id          TEXT PRIMARY KEY,
      category    TEXT NOT NULL,
      method      TEXT NOT NULL,        -- per_ha | per_enterprise | revenue_share
      key_params  TEXT,                 -- JSON, method-specific
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_overhead_rules_cat ON overhead_allocation_rules(category);
  `);
}

module.exports = { initLongHorizonSchema };
