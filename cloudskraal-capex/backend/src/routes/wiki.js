const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { titleToSlug, updatePageLinks, findBrokenLinks, findUnlinkedMentions, invalidateTitleCache } = require('../services/wiki-links');

const router = Router();

// ===========================================================================
// WIKI PAGES
// ===========================================================================

// GET /api/wiki — list pages (summaries, no body)
router.get('/wiki', (req, res) => {
  const db = getDb();
  const { category, enterprise, search, tag } = req.query;

  const conditions = [];
  const params = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (enterprise) {
    conditions.push('enterprise = ?');
    params.push(enterprise);
  }
  let useFts = false;
  let ftsRowids = null;
  if (search) {
    // Try FTS5 first for ranked results
    try {
      const ftsQuery = search.replace(/['"]/g, '') + '*'; // prefix search
      ftsRowids = db.prepare(
        'SELECT rowid, rank FROM wiki_fts WHERE wiki_fts MATCH ? ORDER BY rank LIMIT 50'
      ).all(ftsQuery);
      if (ftsRowids.length > 0) {
        useFts = true;
        conditions.push(`rowid IN (${ftsRowids.map(() => '?').join(',')})`);
        params.push(...ftsRowids.map(r => r.rowid));
      }
    } catch {
      // FTS not available, fall back
    }
    if (!useFts) {
      conditions.push('(title LIKE ? OR body LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
  }
  if (tag) {
    conditions.push('tags LIKE ?');
    params.push(`%"${tag}"%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Include body when searching (for snippet extraction)
  const selectFields = search
    ? 'id, slug, title, body, category, enterprise, tags, pinned, created_at, updated_at'
    : 'id, slug, title, category, enterprise, tags, pinned, created_at, updated_at';

  const pages = db.prepare(`
    SELECT ${selectFields}
    FROM wiki_pages ${where}
    ORDER BY pinned DESC, sort_order ASC, title ASC
  `).all(...params);

  // Parse tags and extract search snippets
  const result = pages.map(p => {
    const base = {
      id: p.id, slug: p.slug, title: p.title, category: p.category,
      enterprise: p.enterprise, tags: p.tags ? JSON.parse(p.tags) : [],
      pinned: p.pinned, created_at: p.created_at, updated_at: p.updated_at,
    };

    if (search && p.body) {
      const lowerBody = p.body.toLowerCase();
      const lowerSearch = search.toLowerCase();
      const idx = lowerBody.indexOf(lowerSearch);
      if (idx >= 0) {
        const start = Math.max(0, idx - 60);
        const end = Math.min(p.body.length, idx + lowerSearch.length + 60);
        const raw = (start > 0 ? '...' : '') + p.body.slice(start, end) + (end < p.body.length ? '...' : '');
        base.snippet = raw;
        base.snippet_term = search;
      }
    }

    return base;
  });

  res.json(result);
});

// GET /api/wiki/graph — knowledge graph data
router.get('/wiki/graph', (req, res) => {
  const db = getDb();

  const pages = db.prepare(`
    SELECT id, slug, title, category, enterprise
    FROM wiki_pages
  `).all();

  const edges = db.prepare(`
    SELECT source_page_id AS source, target_page_id AS target
    FROM wiki_links
  `).all();

  // Count links per page (outgoing + incoming)
  const linkCounts = {};
  for (const edge of edges) {
    linkCounts[edge.source] = (linkCounts[edge.source] || 0) + 1;
    linkCounts[edge.target] = (linkCounts[edge.target] || 0) + 1;
  }

  const nodes = pages.map(p => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    category: p.category,
    enterprise: p.enterprise,
    linkCount: linkCounts[p.id] || 0,
  }));

  res.json({ nodes, edges });
});

// GET /api/wiki/tags — all tags with counts
router.get('/wiki/tags', (req, res) => {
  const db = getDb();
  const pages = db.prepare('SELECT tags FROM wiki_pages WHERE tags IS NOT NULL').all();

  const tagCounts = {};
  for (const p of pages) {
    const tags = JSON.parse(p.tags);
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const result = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  res.json(result);
});

// GET /api/wiki/search?q=term — search pages
router.get('/wiki/search', (req, res) => {
  const db = getDb();
  const { q } = req.query;

  if (!q) return res.status(400).json({ error: 'q query param required' });

  const pages = db.prepare(`
    SELECT id, slug, title, category, enterprise, tags, pinned, created_at, updated_at
    FROM wiki_pages
    WHERE title LIKE ? OR body LIKE ?
    ORDER BY pinned DESC, title ASC
  `).all(`%${q}%`, `%${q}%`);

  const result = pages.map(p => ({
    ...p,
    tags: p.tags ? JSON.parse(p.tags) : [],
  }));

  res.json(result);
});

// GET /api/wiki/:slug — full page with links
router.get('/wiki/:slug', (req, res) => {
  const db = getDb();
  const page = db.prepare('SELECT * FROM wiki_pages WHERE slug = ?').get(req.params.slug);

  if (!page) return res.status(404).json({ error: 'Page not found' });

  // Outgoing links
  const outgoing_links = db.prepare(`
    SELECT wp.slug, wp.title
    FROM wiki_links wl
    JOIN wiki_pages wp ON wp.id = wl.target_page_id
    WHERE wl.source_page_id = ?
  `).all(page.id);

  // Backlinks with context
  const rawBacklinks = db.prepare(`
    SELECT wp.slug, wp.title, wp.body
    FROM wiki_links wl
    JOIN wiki_pages wp ON wp.id = wl.source_page_id
    WHERE wl.target_page_id = ?
  `).all(page.id);

  const backlinks = rawBacklinks.map(bl => {
    // Find the paragraph containing the [[link]] to this page
    let context = '';
    const linkPattern = new RegExp(`\\[\\[${page.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`, 'i');
    const paragraphs = bl.body.split(/\n\n+/);
    for (const p of paragraphs) {
      if (linkPattern.test(p)) {
        context = p.replace(/\[\[([^\]]+)\]\]/g, '$1').slice(0, 120);
        if (p.length > 120) context += '...';
        break;
      }
    }
    return { slug: bl.slug, title: bl.title, context };
  });

  // Broken links (references to non-existent pages)
  const broken_links = findBrokenLinks(db, page.body);

  // Unlinked mentions (page titles in text without [[ ]])
  const unlinked_mentions = findUnlinkedMentions(db, page.id, page.body);

  res.json({
    ...page,
    tags: page.tags ? JSON.parse(page.tags) : [],
    outgoing_links,
    backlinks,
    broken_links,
    unlinked_mentions,
  });
});

// POST /api/wiki — create page
router.post('/wiki', (req, res) => {
  const db = getDb();
  const { title, body, category, enterprise, tags, pinned } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required' });

  const id = uuidv4();
  const slug = titleToSlug(title);
  const now = new Date().toISOString();
  const tagsJson = tags ? JSON.stringify(tags) : null;

  // Check slug uniqueness
  const existing = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?').get(slug);
  if (existing) return res.status(409).json({ error: 'Page with this slug already exists' });

  db.prepare(`
    INSERT INTO wiki_pages (id, slug, title, body, category, enterprise, tags, pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, slug, title, body || '', category || null, enterprise || null, tagsJson, pinned ? 1 : 0, now, now);

  // Parse and update wiki links
  if (body) {
    updatePageLinks(db, id, body);
  }

  invalidateTitleCache();
  auditLog(db, 'create', slug, title);
  const page = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(id);
  res.status(201).json({
    ...page,
    tags: page.tags ? JSON.parse(page.tags) : [],
  });
});

// PATCH /api/wiki/:slug — update page
router.patch('/wiki/:slug', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM wiki_pages WHERE slug = ?').get(req.params.slug);
  if (!existing) return res.status(404).json({ error: 'Page not found' });

  // Save revision before updating
  db.prepare(
    'INSERT INTO wiki_revisions (id, page_id, title, body, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(uuidv4(), existing.id, existing.title, existing.body, existing.updated_at);

  const allowed = ['title', 'body', 'category', 'enterprise', 'tags', 'pinned', 'aliases'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'tags' || key === 'aliases') {
        updates[key] = JSON.stringify(req.body[key]);
      } else if (key === 'pinned') {
        updates[key] = req.body[key] ? 1 : 0;
      } else {
        updates[key] = req.body[key];
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), existing.id];
    db.prepare(`UPDATE wiki_pages SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  // Re-parse wiki links if body changed
  const updatedBody = updates.body !== undefined ? updates.body : existing.body;
  updatePageLinks(db, existing.id, updatedBody);
  invalidateTitleCache();
  auditLog(db, 'update', req.params.slug, updates.title || existing.title, Object.keys(updates).join(', '));

  const page = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(existing.id);
  res.json({
    ...page,
    tags: page.tags ? JSON.parse(page.tags) : [],
  });
});

// GET /api/wiki/daily/:date — find or create daily note (YYYY-MM-DD)
router.get('/wiki/daily/:date', (req, res) => {
  const db = getDb();
  const dateStr = req.params.date; // YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const slug = `daily-${dateStr}`;
  let page = db.prepare('SELECT * FROM wiki_pages WHERE slug = ?').get(slug);

  if (!page) {
    // Create the daily note
    const id = uuidv4();
    const d = new Date(dateStr);
    const title = `Daily Note — ${d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
    const body = `## Observations\n\n\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO wiki_pages (id, slug, title, body, category, enterprise, tags, pinned, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'general', NULL, '["daily"]', 0, 0, ?, ?)
    `).run(id, slug, title, body, now, now);

    page = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(id);
  }

  res.json({
    ...page,
    tags: page.tags ? JSON.parse(page.tags) : [],
  });
});

// PATCH /api/wiki/reorder — update sort order for pages
router.patch('/wiki-reorder', (req, res) => {
  const db = getDb();
  const { items } = req.body; // [{ slug, sort_order }]
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

  const stmt = db.prepare('UPDATE wiki_pages SET sort_order = ? WHERE slug = ?');
  const transaction = db.transaction(() => {
    for (const item of items) {
      stmt.run(item.sort_order, item.slug);
    }
  });
  transaction();
  res.json({ ok: true });
});

// GET /api/wiki/:slug/history — page revision history
router.get('/wiki/:slug/history', (req, res) => {
  const db = getDb();
  const page = db.prepare('SELECT id, title FROM wiki_pages WHERE slug = ?').get(req.params.slug);
  if (!page) return res.status(404).json({ error: 'Page not found' });

  const revisions = db.prepare(`
    SELECT id, title, body, created_at
    FROM wiki_revisions
    WHERE page_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(page.id);

  res.json(revisions);
});

// Audit log helper
function auditLog(db, action, pageSlug, pageTitle, details) {
  db.prepare('INSERT INTO wiki_audit_log (action, page_slug, page_title, details, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(action, pageSlug, pageTitle, details || null, new Date().toISOString());
}

// DELETE /api/wiki/:slug — soft delete (move to trash)
router.delete('/wiki/:slug', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM wiki_pages WHERE slug = ?').get(req.params.slug);
  if (!existing) return res.status(404).json({ error: 'Page not found' });

  // Move to trash
  db.prepare(`
    INSERT INTO wiki_trash (id, slug, title, body, category, enterprise, tags, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(existing.id, existing.slug, existing.title, existing.body, existing.category, existing.enterprise, existing.tags, new Date().toISOString());

  // Delete from main table
  db.prepare('DELETE FROM wiki_pages WHERE id = ?').run(existing.id);
  invalidateTitleCache();
  auditLog(db, 'delete', existing.slug, existing.title);
  res.status(204).send();
});

// GET /api/wiki-trash — list trashed pages
router.get('/wiki-trash', (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT id, slug, title, category, deleted_at FROM wiki_trash ORDER BY deleted_at DESC').all();
  res.json(items);
});

// POST /api/wiki-trash/:id/restore — restore from trash
router.post('/wiki-trash/:id/restore', (req, res) => {
  const db = getDb();
  const trashed = db.prepare('SELECT * FROM wiki_trash WHERE id = ?').get(req.params.id);
  if (!trashed) return res.status(404).json({ error: 'Not found in trash' });

  const now = new Date().toISOString();
  // Check slug uniqueness
  const slugExists = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?').get(trashed.slug);
  const slug = slugExists ? `${trashed.slug}-restored` : trashed.slug;

  db.prepare(`
    INSERT INTO wiki_pages (id, slug, title, body, category, enterprise, tags, pinned, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
  `).run(trashed.id, slug, trashed.title, trashed.body, trashed.category, trashed.enterprise, trashed.tags, now, now);

  db.prepare('DELETE FROM wiki_trash WHERE id = ?').run(trashed.id);
  invalidateTitleCache();
  auditLog(db, 'restore', slug, trashed.title);
  res.json({ slug });
});

// GET /api/wiki-audit — recent audit log
router.get('/wiki-audit', (req, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM wiki_audit_log ORDER BY created_at DESC LIMIT 100').all();
  res.json(logs);
});

module.exports = router;
