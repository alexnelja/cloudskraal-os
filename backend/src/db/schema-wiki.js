function initWikiSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_pages (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      category TEXT,
      enterprise TEXT,
      tags TEXT,
      pinned INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wiki_links (
      id TEXT PRIMARY KEY,
      source_page_id TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
      target_page_id TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
      UNIQUE(source_page_id, target_page_id)
    );
  `);
}

module.exports = { initWikiSchema };
