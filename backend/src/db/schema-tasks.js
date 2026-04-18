const { v4: uuidv4 } = require('uuid');

function initTaskManagerSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL DEFAULT 'cloudskraal',
      name TEXT NOT NULL,
      color TEXT DEFAULT '#9ca3af',
      "group" TEXT DEFAULT 'custom',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      UNIQUE(task_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS task_statuses (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL DEFAULT 'cloudskraal',
      name TEXT NOT NULL,
      color TEXT DEFAULT '#9ca3af',
      category TEXT NOT NULL DEFAULT 'active',
      sort_order INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS task_templates (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL DEFAULT 'cloudskraal',
      name TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      priority TEXT DEFAULT 'medium',
      estimated_minutes INTEGER,
      checklist_items TEXT,
      input_defaults TEXT,
      recurrence_rule TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_tags_farm ON tags(farm_id);
    CREATE INDEX IF NOT EXISTS idx_task_statuses_farm ON task_statuses(farm_id);
  `);
}

function seedDefaultTags(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM tags').get();
  if (count.c > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(
    'INSERT INTO tags (id, farm_id, name, color, "group", sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const categoryTags = [
    { name: 'Crop Ops',       color: '#22c55e' },
    { name: 'Livestock Ops',  color: '#f59e0b' },
    { name: 'Infrastructure', color: '#6b7280' },
    { name: 'Procurement',    color: '#a855f7' },
    { name: 'Labour',         color: '#3b82f6' },
    { name: 'Compliance',     color: '#ef4444' },
    { name: 'Financial',      color: '#14b8a6' },
  ];

  const enterpriseTags = [
    { name: 'Rooibos' },
    { name: 'Wine' },
    { name: 'Sheep' },
    { name: 'Fallow' },
  ];

  const insertAll = db.transaction(() => {
    categoryTags.forEach((t, i) => {
      insert.run(uuidv4(), 'cloudskraal', t.name, t.color, 'category', i, now);
    });
    enterpriseTags.forEach((t, i) => {
      insert.run(uuidv4(), 'cloudskraal', t.name, '#9ca3af', 'enterprise', i, now);
    });
  });

  insertAll();
}

function seedDefaultStatuses(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM task_statuses').get();
  if (count.c > 0) return;

  const insert = db.prepare(
    'INSERT INTO task_statuses (id, farm_id, name, color, category, sort_order, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const statuses = [
    { name: 'Todo',        color: '#9ca3af', category: 'active', is_default: 1 },
    { name: 'In Progress', color: '#3b82f6', category: 'active', is_default: 0 },
    { name: 'Blocked',     color: '#ef4444', category: 'active', is_default: 0 },
    { name: 'Completed',   color: '#22c55e', category: 'done',   is_default: 0 },
    { name: 'Skipped',     color: '#a1a1aa', category: 'closed', is_default: 0 },
    { name: 'Verified',    color: '#8b5cf6', category: 'done',   is_default: 0 },
  ];

  const insertAll = db.transaction(() => {
    statuses.forEach((s, i) => {
      insert.run(uuidv4(), 'cloudskraal', s.name, s.color, s.category, i, s.is_default);
    });
  });

  insertAll();
}

module.exports = { initTaskManagerSchema, seedDefaultTags, seedDefaultStatuses };
