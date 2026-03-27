// Imports markdown files from Obsidian vault into wiki_pages
const { getDb } = require('../src/db/schema');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { updatePageLinks } = require('../src/services/wiki-links');

const VAULT_DIR = process.env.OBSIDIAN_VAULT || path.join(__dirname, '..', '..', 'vault');

const db = getDb();

const files = fs.readdirSync(VAULT_DIR).filter(f => f.endsWith('.md'));
let created = 0, updated = 0;

for (const file of files) {
  const content = fs.readFileSync(path.join(VAULT_DIR, file), 'utf8');
  const slug = file.replace('.md', '');

  // Parse frontmatter
  let body = content;
  let title = slug.replace(/-/g, ' ');
  let category = null;
  let enterprise = null;
  let tags = null;

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    const fm = fmMatch[1];
    body = fmMatch[2].trim();
    const titleMatch = fm.match(/title:\s*"?([^"\n]+)"?/);
    if (titleMatch) title = titleMatch[1].trim();
    const catMatch = fm.match(/category:\s*(\S+)/);
    if (catMatch && catMatch[1]) category = catMatch[1];
    const entMatch = fm.match(/enterprise:\s*(\S+)/);
    if (entMatch && entMatch[1]) enterprise = entMatch[1];
    const tagsMatch = fm.match(/tags:\s*\[([^\]]*)\]/);
    if (tagsMatch) tags = JSON.stringify(tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean));
  }

  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?').get(slug);

  if (existing) {
    db.prepare('UPDATE wiki_pages SET title = ?, body = ?, category = ?, enterprise = ?, tags = ?, updated_at = ? WHERE slug = ?')
      .run(title, body, category, enterprise, tags, now, slug);
    updatePageLinks(db, existing.id, body);
    updated++;
  } else {
    const id = uuidv4();
    db.prepare('INSERT INTO wiki_pages (id, slug, title, body, category, enterprise, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, slug, title, body, category, enterprise, tags, now, now);
    updatePageLinks(db, id, body);
    created++;
  }
}

console.log(`Synced ${files.length} files: ${created} created, ${updated} updated`);
