function initAnnotationsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS annotations (
      id             TEXT PRIMARY KEY,
      type           TEXT NOT NULL CHECK (type IN ('line','polygon','pin')),
      title          TEXT NOT NULL,
      notes          TEXT,
      geometry_json  TEXT NOT NULL,
      length_m       REAL,
      area_m2        REAL,
      field_id       TEXT REFERENCES fields(id) ON DELETE SET NULL,
      farm_id        TEXT REFERENCES farms(id)  ON DELETE SET NULL,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      category       TEXT,
      metadata_json  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_annotations_type
      ON annotations(type);
    CREATE INDEX IF NOT EXISTS idx_annotations_field_id
      ON annotations(field_id);
    CREATE INDEX IF NOT EXISTS idx_annotations_created_at
      ON annotations(created_at);
  `);
}

module.exports = { initAnnotationsSchema };
