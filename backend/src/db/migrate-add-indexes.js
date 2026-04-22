function migrateAddIndexes(db) {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_fields_farm_id ON fields(farm_id)',
    'CREATE INDEX IF NOT EXISTS idx_fields_enterprise ON fields(enterprise)',
    'CREATE INDEX IF NOT EXISTS idx_fields_farm_enterprise ON fields(farm_id, enterprise)',
    'CREATE INDEX IF NOT EXISTS idx_inv_tx_product_date ON inventory_transactions(product_id, date DESC)',
    'CREATE INDEX IF NOT EXISTS idx_inv_tx_field ON inventory_transactions(field_id)',
    'CREATE INDEX IF NOT EXISTS idx_time_entries_emp_date ON time_entries(employee_id, date DESC)',
    'CREATE INDEX IF NOT EXISTS idx_time_entries_field ON time_entries(field_id)',
    'CREATE INDEX IF NOT EXISTS idx_fin_tx_date ON financial_transactions(date DESC)',
    'CREATE INDEX IF NOT EXISTS idx_fin_tx_enterprise ON financial_transactions(enterprise_id, date DESC)',
    // 2026-04-21 — hot-path indexes flagged by the DB audit. Tasks filtered
    // by field/enterprise, calendar by start_date, livestock records scanned
    // per group by date, processing steps ordered inside a batch.
    'CREATE INDEX IF NOT EXISTS idx_tasks_field_id ON tasks(field_id)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_enterprise ON tasks(enterprise)',
    'CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date)',
    'CREATE INDEX IF NOT EXISTS idx_calendar_events_enterprise ON calendar_events(enterprise)',
    'CREATE INDEX IF NOT EXISTS idx_livestock_records_group_date ON livestock_records(group_id, date DESC)',
    'CREATE INDEX IF NOT EXISTS idx_processing_steps_batch_step ON processing_steps(batch_id, step_number)',
  ];
  for (const sql of indexes) {
    try { db.exec(sql); } catch { /* table may not exist yet */ }
  }
}

module.exports = { migrateAddIndexes };
