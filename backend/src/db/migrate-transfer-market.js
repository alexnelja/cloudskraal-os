// Spec 2f.3c — adds per-event market-price columns for at-market transfer
// pricing on DBs created before they existed. Idempotent. (farm_config table is
// created via its own init migration.)
function hasCol(db, table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
}

function migrateTransferMarket(db) {
  if (!hasCol(db, 'grazing_events', 'market_value_zar')) {
    db.exec('ALTER TABLE grazing_events ADD COLUMN market_value_zar REAL');
  }
  if (!hasCol(db, 'feeding_events', 'market_price_zar')) {
    db.exec('ALTER TABLE feeding_events ADD COLUMN market_price_zar REAL');
  }
}

module.exports = { migrateTransferMarket };
