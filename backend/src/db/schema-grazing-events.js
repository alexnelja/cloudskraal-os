// Spec 2f.2 Slice B — grazing events. A flock grazes a crop/veld field over a
// date range; allocation_fraction (0–1, user-set) is the share of that field's
// annual COP attributed to the flock. Valued at-cost (the field's own COP).
function initGrazingEventsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS grazing_events (
      id                  TEXT PRIMARY KEY,
      group_id            TEXT NOT NULL REFERENCES livestock_groups(id) ON DELETE CASCADE,
      field_id            TEXT REFERENCES fields(id),
      start_date          TEXT NOT NULL,
      end_date            TEXT,
      allocation_fraction REAL NOT NULL,
      notes               TEXT,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_grazing_events_group ON grazing_events(group_id);
    CREATE INDEX IF NOT EXISTS idx_grazing_events_field ON grazing_events(field_id);
  `);
}

module.exports = { initGrazingEventsSchema };
