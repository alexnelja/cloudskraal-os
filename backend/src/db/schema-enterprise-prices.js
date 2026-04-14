function initEnterprisePricesSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS enterprise_prices (
      id            TEXT PRIMARY KEY,
      enterprise    TEXT NOT NULL,
      year          INTEGER NOT NULL,
      price_per_kg  REAL NOT NULL,
      notes         TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ent_prices_unique
      ON enterprise_prices(enterprise, year);
  `);
}

module.exports = { initEnterprisePricesSchema };
