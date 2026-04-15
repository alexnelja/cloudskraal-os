function migrateTasksAnnotationLink(db) {
  const cols = db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name);
  if (!cols.includes('annotation_id')) {
    db.exec('ALTER TABLE tasks ADD COLUMN annotation_id TEXT REFERENCES annotations(id) ON DELETE SET NULL');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_annotation_id ON tasks(annotation_id)');
}

module.exports = { migrateTasksAnnotationLink };
