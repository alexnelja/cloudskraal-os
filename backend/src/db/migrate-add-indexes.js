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
  ];
  for (const sql of indexes) {
    try { db.exec(sql); } catch { /* table may not exist yet */ }
  }
}

module.exports = { migrateAddIndexes };
