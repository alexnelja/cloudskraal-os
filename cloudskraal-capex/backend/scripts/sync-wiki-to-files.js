// Exports wiki_pages to markdown files for Obsidian
const { getDb } = require('../src/db/schema');
const fs = require('fs');
const path = require('path');

const VAULT_DIR = process.env.OBSIDIAN_VAULT || path.join(__dirname, '..', '..', 'vault');

const db = getDb();
const pages = db.prepare('SELECT * FROM wiki_pages').all();

if (!fs.existsSync(VAULT_DIR)) fs.mkdirSync(VAULT_DIR, { recursive: true });

for (const page of pages) {
  const tags = page.tags ? JSON.parse(page.tags) : [];
  const frontmatter = [
    '---',
    `title: "${page.title}"`,
    `slug: "${page.slug}"`,
    `category: ${page.category || ''}`,
    `enterprise: ${page.enterprise || ''}`,
    `tags: [${tags.join(', ')}]`,
    `updated: ${page.updated_at}`,
    '---',
    '',
  ].join('\n');

  const content = frontmatter + page.body;
  const filename = `${page.slug}.md`;
  fs.writeFileSync(path.join(VAULT_DIR, filename), content, 'utf8');
}

console.log(`Exported ${pages.length} wiki pages to ${VAULT_DIR}`);
