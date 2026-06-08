// Spec 2f.2 Slice C — feeding events. Itemised feed given to a flock.
//   purchased: cost = quantity_kg × unit_cost_zar (no field leg)
//   internal:  at cost = quantity_kg × source field line cost_per_kg (two-leg)
function initFeedingEventsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feeding_events (
      id              TEXT PRIMARY KEY,
      group_id        TEXT NOT NULL REFERENCES livestock_groups(id) ON DELETE CASCADE,
      date            TEXT NOT NULL,
      source_type     TEXT NOT NULL,          -- 'purchased' | 'internal'
      source_field_id TEXT REFERENCES fields(id),
      source_usage    TEXT,                   -- internal: which field COP line
      product         TEXT,
      quantity_kg     REAL,
      unit_cost_zar   REAL,                   -- purchased: R/kg paid
      notes           TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_feeding_events_group ON feeding_events(group_id);
    CREATE INDEX IF NOT EXISTS idx_feeding_events_field ON feeding_events(source_field_id);
  `);
}

module.exports = { initFeedingEventsSchema };
