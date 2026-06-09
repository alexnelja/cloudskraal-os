// Spec 2i.3 — field activities (operations): machine + attachment + operator
// applied to a chosen set of fields, split by link-ha (fallback field area).
// Provenance columns (entry_basis/external_source/external_id) ready for Xero.
function initActivitiesSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS field_activities (
      id                   TEXT PRIMARY KEY,
      date                 TEXT,
      year                 INTEGER NOT NULL,
      activity_type        TEXT,
      enterprise           TEXT,
      equipment_id         TEXT REFERENCES equipment(id),
      attachment_id        TEXT REFERENCES equipment(id),
      operator_employee_id TEXT REFERENCES employees(id),
      hours                REAL,
      ha_covered           REAL,
      is_establishment     INTEGER DEFAULT 0,
      entry_basis          TEXT DEFAULT 'estimate',  -- 'estimate' | 'actual'
      external_source      TEXT,            -- null | 'xero' | 'quickbooks'
      external_id          TEXT,
      notes                TEXT,
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS field_activity_fields (
      id          TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES field_activities(id) ON DELETE CASCADE,
      field_id    TEXT REFERENCES fields(id),
      ha          REAL
    );
    CREATE INDEX IF NOT EXISTS idx_field_activity_fields_act ON field_activity_fields(activity_id);
    CREATE INDEX IF NOT EXISTS idx_field_activity_fields_field ON field_activity_fields(field_id);
    CREATE INDEX IF NOT EXISTS idx_field_activities_year ON field_activities(year);
    -- idempotent import: an external line lands once
    CREATE UNIQUE INDEX IF NOT EXISTS idx_field_activities_external
      ON field_activities(external_source, external_id) WHERE external_id IS NOT NULL;
  `);
}

module.exports = { initActivitiesSchema };
