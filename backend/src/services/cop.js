function usageOnDate(db, fieldId, dateStr) {
  const row = db.prepare(`
    SELECT id AS period_id, usage
      FROM field_usage_period
     WHERE field_id = ?
       AND deleted_at IS NULL
       AND start_date <= ?
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY start_date DESC
     LIMIT 1
  `).get(fieldId, dateStr, dateStr);
  return row ? { usage: row.usage, period_id: row.period_id } : null;
}

module.exports = { usageOnDate };
