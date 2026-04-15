function migrateAnnotationsCategory(db) {
  const cols = db.prepare("PRAGMA table_info(annotations)").all().map((c) => c.name);
  if (!cols.includes('category')) {
    db.exec('ALTER TABLE annotations ADD COLUMN category TEXT');
  }
  if (!cols.includes('metadata_json')) {
    db.exec('ALTER TABLE annotations ADD COLUMN metadata_json TEXT');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_annotations_category ON annotations(category)');
}

module.exports = { migrateAnnotationsCategory };
