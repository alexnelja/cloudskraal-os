function probeAndAdd(db, table, column, ddl, indexDdl) {
  try {
    db.prepare(`SELECT ${column} FROM ${table} LIMIT 1`).get();
  } catch (e) {
    db.exec(ddl);
    console.log(`  Migrated: added ${column} to ${table}`);
  }
  if (indexDdl) db.exec(indexDdl);
}

function migrateFieldCop(db) {
  probeAndAdd(
    db, 'field_production', 'harvest_date',
    'ALTER TABLE field_production ADD COLUMN harvest_date TEXT',
    'CREATE INDEX IF NOT EXISTS idx_fprod_field_harvest ON field_production(field_id, harvest_date)'
  );
  probeAndAdd(
    db, 'inventory_transactions', 'cost_category',
    "ALTER TABLE inventory_transactions ADD COLUMN cost_category TEXT NOT NULL DEFAULT 'direct_variable'",
  );
  probeAndAdd(
    db, 'time_entries', 'cost_category',
    "ALTER TABLE time_entries ADD COLUMN cost_category TEXT NOT NULL DEFAULT 'direct_variable'",
  );
}

module.exports = { migrateFieldCop };
