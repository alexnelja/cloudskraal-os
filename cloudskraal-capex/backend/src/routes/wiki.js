const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { titleToSlug, updatePageLinks } = require('../services/wiki-links');

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
  if (search) {
    conditions.push('(title LIKE ? OR body LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (tag) {
    conditions.push('tags LIKE ?');
    params.push(`%"${tag}"%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const pages = db.prepare(`
    SELECT id, slug, title, category, enterprise, tags, pinned, created_at, updated_at
    FROM wiki_pages ${where}
    ORDER BY pinned DESC, title ASC
  `).all(...params);

  // Parse tags from JSON string
  const result = pages.map(p => ({
    ...p,
    tags: p.tags ? JSON.parse(p.tags) : [],
  }));

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

  // Backlinks
  const backlinks = db.prepare(`
    SELECT wp.slug, wp.title
    FROM wiki_links wl
    JOIN wiki_pages wp ON wp.id = wl.source_page_id
    WHERE wl.target_page_id = ?
  `).all(page.id);

  res.json({
    ...page,
    tags: page.tags ? JSON.parse(page.tags) : [],
    outgoing_links,
    backlinks,
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

  const allowed = ['title', 'body', 'category', 'enterprise', 'tags', 'pinned'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'tags') {
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

  const page = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(existing.id);
  res.json({
    ...page,
    tags: page.tags ? JSON.parse(page.tags) : [],
  });
});

// DELETE /api/wiki/:slug — delete page (cascades links)
router.delete('/wiki/:slug', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?').get(req.params.slug);
  if (!existing) return res.status(404).json({ error: 'Page not found' });

  db.prepare('DELETE FROM wiki_pages WHERE id = ?').run(existing.id);
  res.status(204).send();
});

module.exports = router;
