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

function periodsOverlappingYear(db, fieldId, year) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  return db.prepare(`
    SELECT id, usage, start_date, end_date, planted_date, source
      FROM field_usage_period
     WHERE field_id = ?
       AND deleted_at IS NULL
       AND start_date <= ?
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY start_date ASC
  `).all(fieldId, yearEnd, yearStart);
}

module.exports = { usageOnDate, periodsOverlappingYear };
