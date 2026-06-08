// Spec 2f.3c — simple key/value farm settings. First key:
// transfer_pricing_mode = 'at_cost' (default) | 'at_market'.
function initFarmConfigSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS farm_config (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TEXT
    );
  `);
}

module.exports = { initFarmConfigSchema };
