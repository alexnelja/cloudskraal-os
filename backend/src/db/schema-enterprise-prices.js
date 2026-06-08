function initEnterprisePricesSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS enterprise_prices (
      id            TEXT PRIMARY KEY,
      enterprise    TEXT NOT NULL,
      year          INTEGER NOT NULL,
      price_per_kg  REAL NOT NULL,
      price_basis   TEXT,
      notes         TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ent_prices_unique
      ON enterprise_prices(enterprise, year);
  `);

  // Self-migrate DBs created before price_basis existed. price_basis is the
  // unit-of-measure the price is quoted on (e.g. sifted_netto_dry_kg), so
  // margin can align COP cost onto the same basis via conversion_factors.
  const hasBasis = db.prepare('PRAGMA table_info(enterprise_prices)')
    .all().some(c => c.name === 'price_basis');
  if (!hasBasis) {
    db.exec('ALTER TABLE enterprise_prices ADD COLUMN price_basis TEXT');
  }
}

module.exports = { initEnterprisePricesSchema };
