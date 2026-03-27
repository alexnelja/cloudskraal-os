function initCalendarSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      enterprise TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      all_day INTEGER DEFAULT 1,
      recurrence_rule TEXT,
      color TEXT,
      notes TEXT,
      google_event_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      enterprise TEXT,
      field_id TEXT REFERENCES fields(id),
      type TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      due_date TEXT,
      completed_date TEXT,
      completed_by TEXT,
      assigned_to TEXT,
      depends_on_task_id TEXT REFERENCES tasks(id),
      recurrence_rule TEXT,
      calendar_event_id TEXT REFERENCES calendar_events(id),
      google_event_id TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_inputs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      category TEXT,
      rate REAL,
      rate_unit TEXT,
      total_applied REAL,
      total_unit TEXT,
      cost_per_unit REAL,
      total_cost REAL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS task_checklists (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      item TEXT NOT NULL,
      checked INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );
  `);

  // Migration: add google_event_id columns if they don't exist yet
  try {
    db.prepare('SELECT google_event_id FROM calendar_events LIMIT 1').get();
  } catch (e) {
    db.exec('ALTER TABLE calendar_events ADD COLUMN google_event_id TEXT');
    console.log('  Migrated: added google_event_id to calendar_events');
  }

  try {
    db.prepare('SELECT google_event_id FROM tasks LIMIT 1').get();
  } catch (e) {
    db.exec('ALTER TABLE tasks ADD COLUMN google_event_id TEXT');
    console.log('  Migrated: added google_event_id to tasks');
  }
}

module.exports = { initCalendarSchema };
