// Spec 3.2 — task templates: usage-filtered operation suggestions with default
// inputs (rate/ha), duration, and an optional per-ha operation rate. Tasks gain
// template provenance + a cost estimate frozen at create time (no price drift).
function initTaskTemplatesSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_op_templates (
      id                   TEXT PRIMARY KEY,
      usage                TEXT NOT NULL,      -- matches field_usage_period.usage
      op_type              TEXT NOT NULL,      -- spray, harvest, prune, plant, fertilize, disc…
      name                 TEXT NOT NULL,
      default_inputs_json  TEXT,               -- [{product, rate_per_ha, unit}]
      default_duration_hrs REAL,
      default_unit_rate    REAL,               -- R per ha operation charge
      notes                TEXT,
      sort_order           INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_task_op_templates_usage ON task_op_templates(usage);
  `);

  const cols = db.prepare('PRAGMA table_info(tasks)').all().map(c => c.name);
  if (!cols.includes('template_id')) {
    db.exec('ALTER TABLE tasks ADD COLUMN template_id TEXT REFERENCES task_op_templates(id)');
  }
  if (!cols.includes('estimated_cost_zar')) {
    db.exec('ALTER TABLE tasks ADD COLUMN estimated_cost_zar REAL');
  }
}

module.exports = { initTaskTemplatesSchema };
