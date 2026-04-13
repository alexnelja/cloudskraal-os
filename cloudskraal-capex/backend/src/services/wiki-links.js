const { v4: uuidv4 } = require('uuid');

/**
 * Extract [[wiki-links]] from markdown body.
 * Returns array of slugs referenced.
 */
function extractWikiLinks(body) {
  const regex = /\[\[([^\]]{1,500})\]\]/g;
  const links = [];
  let match;
  let iterations = 0;
  while ((match = regex.exec(body)) !== null && iterations++ < 1000) {
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
  const findByAlias = db.prepare("SELECT id FROM wiki_pages WHERE aliases LIKE ?");

  for (const slug of slugs) {
    let target = findPage.get(slug);
    // Try alias resolution if direct slug not found
    if (!target) {
      target = findByAlias.get(`%"${slug}"%`);
    }
    if (target) {
      insertLink.run(uuidv4(), pageId, target.id);
    }
  }
}

/**
 * Find [[links]] in body that point to pages that don't exist.
 * Returns array of { slug, title } for broken links.
 */
function findBrokenLinks(db, body) {
  const regex = /\[\[([^\]]{1,500})\]\]/g;
  const broken = [];
  const seen = new Set();
  let match;
  let iterations = 0;
  while ((match = regex.exec(body)) !== null && iterations++ < 1000) {
    const title = match[1].trim();
    const slug = titleToSlug(title);
    if (seen.has(slug)) continue;
    seen.add(slug);
    const exists = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?').get(slug)
      || db.prepare("SELECT id FROM wiki_pages WHERE aliases LIKE ?").get(`%"${slug}"%`);
    if (!exists) {
      broken.push({ slug, title });
    }
  }
  return broken;
}

/**
 * Find page titles that appear in body text without [[]] wrapping.
 * Returns array of { slug, title, count } for unlinked mentions.
 */
// Cached title index — rebuilt when pages change
let _titleCache = null;
let _titleCacheTime = 0;

function getTitleIndex(db, excludePageId) {
  // Rebuild cache every 30 seconds
  const now = Date.now();
  if (!_titleCache || now - _titleCacheTime > 30000) {
    _titleCache = db.prepare('SELECT id, slug, title FROM wiki_pages').all();
    _titleCacheTime = now;
  }
  return _titleCache.filter(p => p.id !== excludePageId && p.title.length >= 3);
}

function findUnlinkedMentions(db, pageId, body) {
  const stripped = body.replace(/\[\[([^\]]+)\]\]/g, '');
  const pages = getTitleIndex(db, pageId);
  if (pages.length === 0) return [];

  // Build one combined regex with alternation — O(1) passes over the text
  const mentions = [];
  // Process in batches to avoid regex too large
  const batchSize = 50;
  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const pattern = batch
      .map(p => `(?<_${p.slug.replace(/[^a-z0-9]/g, '_')}>\\b${p.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b)`)
      .join('|');

    try {
      const regex = new RegExp(pattern, 'gi');
      let match;
      const counts = new Map();
      let iterations = 0;
      while ((match = regex.exec(stripped)) !== null && iterations++ < 5000) {
        // Find which group matched
        for (const page of batch) {
          if (match[0].toLowerCase() === page.title.toLowerCase()) {
            counts.set(page.slug, (counts.get(page.slug) || 0) + 1);
            break;
          }
        }
      }
      for (const page of batch) {
        const count = counts.get(page.slug);
        if (count) mentions.push({ slug: page.slug, title: page.title, count });
      }
    } catch {
      // Regex compilation failed for this batch — fall back to individual
      for (const page of batch) {
        const escaped = page.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        const matches = stripped.match(regex);
        if (matches) mentions.push({ slug: page.slug, title: page.title, count: matches.length });
      }
    }
  }

  return mentions.sort((a, b) => b.count - a.count);
}

function invalidateTitleCache() {
  _titleCache = null;
}

module.exports = { extractWikiLinks, titleToSlug, updatePageLinks, findBrokenLinks, findUnlinkedMentions, invalidateTitleCache };
