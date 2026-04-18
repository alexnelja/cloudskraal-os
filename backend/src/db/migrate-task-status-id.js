function migrateTaskStatusId(db) {
  const cols = db.prepare('PRAGMA table_info(tasks)').all().map(c => c.name);

  // Phase 1: Add status_id column if not exists
  if (!cols.includes('status_id')) {
    db.exec('ALTER TABLE tasks ADD COLUMN status_id TEXT REFERENCES task_statuses(id)');
  }

  // Phase 2: Backfill status_id from status text
  const unmapped = db.prepare(
    'SELECT DISTINCT status FROM tasks WHERE status IS NOT NULL AND status_id IS NULL'
  ).all();

  for (const { status } of unmapped) {
    // Map old status names to new status names (pending->Todo, in_progress->In Progress, etc)
    const nameMap = {
      'pending': 'Todo',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'skipped': 'Skipped',
      'overdue': 'Todo',  // overdue was calculated, not a real status
    };
    const lookupName = nameMap[status] || status;
    const match = db.prepare(
      'SELECT id FROM task_statuses WHERE LOWER(name) = LOWER(?) LIMIT 1'
    ).get(lookupName);

    if (match) {
      db.prepare('UPDATE tasks SET status_id = ? WHERE status = ? AND status_id IS NULL')
        .run(match.id, status);
    }
  }

  // Phase 3: Add additional task manager columns
  const newCols = [
    ['estimated_minutes', 'INTEGER'],
    ['actual_minutes', 'INTEGER'],
    ['blocked_reason', 'TEXT'],
    ['blocked_until', 'TEXT'],
    ['sort_order', 'INTEGER DEFAULT 0'],
    ['verified_by', 'TEXT'],
    ['verified_at', 'TEXT'],
  ];

  for (const [colName, colType] of newCols) {
    if (!cols.includes(colName)) {
      db.exec(`ALTER TABLE tasks ADD COLUMN ${colName} ${colType}`);
    }
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_status_id ON tasks(status_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
}

module.exports = { migrateTaskStatusId };
