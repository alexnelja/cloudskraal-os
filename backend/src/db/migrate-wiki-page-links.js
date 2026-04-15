function migrateWikiPageLinks(db) {
  const taskCols = db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name);
  if (!taskCols.includes('wiki_page_id')) {
    db.exec('ALTER TABLE tasks ADD COLUMN wiki_page_id TEXT REFERENCES wiki_pages(id) ON DELETE SET NULL');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_wiki_page_id ON tasks(wiki_page_id)');

  const annCols = db.prepare('PRAGMA table_info(annotations)').all().map((c) => c.name);
  if (!annCols.includes('wiki_page_id')) {
    db.exec('ALTER TABLE annotations ADD COLUMN wiki_page_id TEXT REFERENCES wiki_pages(id) ON DELETE SET NULL');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_annotations_wiki_page_id ON annotations(wiki_page_id)');
}

module.exports = { migrateWikiPageLinks };
