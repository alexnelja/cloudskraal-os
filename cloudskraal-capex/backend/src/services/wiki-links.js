const { v4: uuidv4 } = require('uuid');

/**
 * Extract [[wiki-links]] from markdown body.
 * Returns array of slugs referenced.
 */
function extractWikiLinks(body) {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    const title = match[1].trim();
    links.push(titleToSlug(title));
  }
  return [...new Set(links)]; // deduplicate
}

function titleToSlug(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * After saving a wiki page, update the wiki_links table.
 * Parses body for [[links]], resolves slugs to page IDs, updates links.
 */
function updatePageLinks(db, pageId, body) {
  // Delete existing outgoing links
  db.prepare('DELETE FROM wiki_links WHERE source_page_id = ?').run(pageId);

  const slugs = extractWikiLinks(body);
  if (slugs.length === 0) return;

  const insertLink = db.prepare(
    'INSERT OR IGNORE INTO wiki_links (id, source_page_id, target_page_id) VALUES (?, ?, ?)'
  );

  const findPage = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?');

  for (const slug of slugs) {
    const target = findPage.get(slug);
    if (target) {
      insertLink.run(uuidv4(), pageId, target.id);
    }
  }
}

module.exports = { extractWikiLinks, titleToSlug, updatePageLinks };
