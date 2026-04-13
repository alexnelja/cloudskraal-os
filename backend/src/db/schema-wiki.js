function initWikiSchema(db) {
  // Migrations
  try { db.prepare('SELECT sort_order FROM wiki_pages LIMIT 1').get(); } catch {
    try { db.exec('ALTER TABLE wiki_pages ADD COLUMN sort_order INTEGER DEFAULT 0'); } catch { /* exists */ }
  }
  try { db.prepare('SELECT aliases FROM wiki_pages LIMIT 1').get(); } catch {
    try { db.exec('ALTER TABLE wiki_pages ADD COLUMN aliases TEXT'); } catch { /* exists */ }
  }

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
      sort_order INTEGER DEFAULT 0,
      aliases TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wiki_revisions (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wiki_links (
      id TEXT PRIMARY KEY,
      source_page_id TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
      target_page_id TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
      UNIQUE(source_page_id, target_page_id)
    );
  `);

  // Trash table for soft deletes
  db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_trash (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      category TEXT,
      enterprise TEXT,
      tags TEXT,
      deleted_at TEXT NOT NULL
    );
  `);

  // Audit log
  db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      page_slug TEXT,
      page_title TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // FTS5 full-text search index
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS wiki_fts USING fts5(
        title, body, tags,
        content='wiki_pages',
        content_rowid='rowid'
      );
    `);

    // Triggers to keep FTS in sync
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS wiki_fts_insert AFTER INSERT ON wiki_pages BEGIN
        INSERT INTO wiki_fts(rowid, title, body, tags) VALUES (NEW.rowid, NEW.title, NEW.body, NEW.tags);
      END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS wiki_fts_delete AFTER DELETE ON wiki_pages BEGIN
        INSERT INTO wiki_fts(wiki_fts, rowid, title, body, tags) VALUES ('delete', OLD.rowid, OLD.title, OLD.body, OLD.tags);
      END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS wiki_fts_update AFTER UPDATE ON wiki_pages BEGIN
        INSERT INTO wiki_fts(wiki_fts, rowid, title, body, tags) VALUES ('delete', OLD.rowid, OLD.title, OLD.body, OLD.tags);
        INSERT INTO wiki_fts(rowid, title, body, tags) VALUES (NEW.rowid, NEW.title, NEW.body, NEW.tags);
      END;
    `);

    // Rebuild FTS index from existing data
    const ftsCount = db.prepare('SELECT count(*) as c FROM wiki_fts').get();
    const pageCount = db.prepare('SELECT count(*) as c FROM wiki_pages').get();
    if (ftsCount.c === 0 && pageCount.c > 0) {
      db.exec("INSERT INTO wiki_fts(wiki_fts) VALUES('rebuild')");
      console.log(`  FTS index rebuilt for ${pageCount.c} wiki pages.`);
    }
  } catch (e) {
    console.log('  FTS5 setup skipped (may already exist):', e.message?.slice(0, 60));
  }
}

module.exports = { initWikiSchema };
