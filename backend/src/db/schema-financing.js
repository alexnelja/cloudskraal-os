// Spec 2i.5 — financing costs: a SEPARATE interest stream (working capital,
// establishment loans, land loans). Time/borrowing-structure dependent —
// principal × rate × period — never a per-ha/per-enterprise overhead spread.
// Provenance columns follow the 2i convention for future Xero import.
function initFinancingSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS financing_costs (
      id              TEXT PRIMARY KEY,
      year            INTEGER NOT NULL,
      kind            TEXT NOT NULL,     -- working_capital | establishment_loan | land_loan | other
      description     TEXT,
      principal_zar   REAL,
      annual_rate_pct REAL,
      months          REAL,
      interest_zar    REAL NOT NULL,     -- explicit, or principal × rate × months/12
      enterprise      TEXT,              -- optional routing; NULL = farm-wide
      field_id        TEXT REFERENCES fields(id),
      entry_basis     TEXT DEFAULT 'estimate',
      external_source TEXT,
      external_id     TEXT,
      notes           TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_financing_costs_year ON financing_costs(year);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_financing_costs_external
      ON financing_costs(external_source, external_id) WHERE external_id IS NOT NULL;
  `);
}

module.exports = { initFinancingSchema };
