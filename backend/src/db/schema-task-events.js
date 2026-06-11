// Spec 4.1 — task lifecycle: append-only audit trail + lifecycle columns on
// tasks. `state` is the machine (scheduled → in_progress → completed →
// verified, cancelled off-ramp); legacy `status` is kept in sync for old UI.
function initTaskEventsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_events (
      id           TEXT PRIMARY KEY,
      task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      event_type   TEXT NOT NULL,   -- created|started|paused|resumed|completed|verified|cancelled|edited
      at           TEXT NOT NULL,
      by           TEXT,
      notes        TEXT,
      payload_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id, at);
  `);

  const cols = db.prepare('PRAGMA table_info(tasks)').all().map(c => c.name);
  const add = (name, ddl) => { if (!cols.includes(name)) db.exec(`ALTER TABLE tasks ADD COLUMN ${ddl}`); };
  add('state', 'state TEXT');
  add('actual_start', 'actual_start TEXT');
  add('actual_end', 'actual_end TEXT');
  add('actual_inputs_json', 'actual_inputs_json TEXT');
  add('actual_duration_hrs', 'actual_duration_hrs REAL');
  add('actual_area_ha', 'actual_area_ha REAL');
  add('verified_at', 'verified_at TEXT');
  add('verified_by', 'verified_by TEXT');
  add('cancelled_reason', 'cancelled_reason TEXT');
}

module.exports = { initTaskEventsSchema };
