// Spec 2f.3d — stocking-density auto-allocation. Adds fields.ssu_per_ha and
// grazing_events.head_count, and relaxes grazing_events.allocation_fraction from
// NOT NULL to nullable (null → auto-allocate). Idempotent.
function hasCol(db, table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
}

function migrateStockingDensity(db) {
  if (!hasCol(db, 'fields', 'ssu_per_ha')) {
    db.exec('ALTER TABLE fields ADD COLUMN ssu_per_ha REAL');
  }
  if (!hasCol(db, 'grazing_events', 'head_count')) {
    db.exec('ALTER TABLE grazing_events ADD COLUMN head_count INTEGER');
  }
  // Relax allocation_fraction NOT NULL → nullable (table rebuild; grazing_events
  // is a leaf with no inbound FKs, so this is safe).
  const frac = db.prepare('PRAGMA table_info(grazing_events)')
    .all().find(c => c.name === 'allocation_fraction');
  if (frac && frac.notnull === 1) {
    db.exec(`
      CREATE TABLE grazing_events__new (
        id                  TEXT PRIMARY KEY,
        group_id            TEXT NOT NULL REFERENCES livestock_groups(id) ON DELETE CASCADE,
        field_id            TEXT REFERENCES fields(id),
        start_date          TEXT NOT NULL,
        end_date            TEXT,
        allocation_fraction REAL,
        head_count          INTEGER,
        notes               TEXT,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      );
      INSERT INTO grazing_events__new
        (id,group_id,field_id,start_date,end_date,allocation_fraction,head_count,notes,created_at,updated_at)
        SELECT id,group_id,field_id,start_date,end_date,allocation_fraction,head_count,notes,created_at,updated_at
          FROM grazing_events;
      DROP TABLE grazing_events;
      ALTER TABLE grazing_events__new RENAME TO grazing_events;
      CREATE INDEX IF NOT EXISTS idx_grazing_events_group ON grazing_events(group_id);
      CREATE INDEX IF NOT EXISTS idx_grazing_events_field ON grazing_events(field_id);
    `);
  }
}

module.exports = { migrateStockingDensity };
