// Spec 2i.1 — shared inputs: a bulk input applied to a chosen set of fields,
// split per-ha (rate × ha) or by ha-share of a total. Provenance columns
// (entry_basis/external_source/external_id) ready imported Xero/QuickBooks actuals.
function initSharedInputsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_inputs (
      id               TEXT PRIMARY KEY,
      date             TEXT,
      year             INTEGER NOT NULL,
      product          TEXT,
      cost_category    TEXT DEFAULT 'direct_variable',
      basis            TEXT,            -- 'per_ha_rate' | 'total_split_ha'
      rate_per_ha      REAL,
      total_cost_zar   REAL,
      usage            TEXT,            -- optional: route to a specific usage line
      is_establishment INTEGER DEFAULT 0,
      entry_basis      TEXT DEFAULT 'estimate',  -- 'estimate' | 'actual'
      external_source  TEXT,            -- null | 'xero' | 'quickbooks'
      external_id      TEXT,
      notes            TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shared_input_fields (
      id              TEXT PRIMARY KEY,
      shared_input_id TEXT NOT NULL REFERENCES shared_inputs(id) ON DELETE CASCADE,
      field_id        TEXT REFERENCES fields(id)
    );
    CREATE INDEX IF NOT EXISTS idx_shared_input_fields_si ON shared_input_fields(shared_input_id);
    CREATE INDEX IF NOT EXISTS idx_shared_input_fields_field ON shared_input_fields(field_id);
    CREATE INDEX IF NOT EXISTS idx_shared_inputs_year ON shared_inputs(year);
    -- idempotent import: an external line lands once
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_inputs_external
      ON shared_inputs(external_source, external_id) WHERE external_id IS NOT NULL;
  `);
}

module.exports = { initSharedInputsSchema };
