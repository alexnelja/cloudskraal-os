// Backfill migration: adds price_basis to enterprise_prices on DBs that ran
// init-enterprise-prices-schema before the column existed, and sets the rooibos
// basis on existing rows. Registered separately in schema.js because the
// original schema migration is already marked applied on live DBs.
//
// Other enterprises set their own basis when their prices are added — only
// rooibos has a known sale basis today.
const ROOIBOS_PRICE_BASIS = 'sifted_netto_dry_kg';

function migrateEnterprisePriceBasis(db) {
  const hasBasis = db.prepare('PRAGMA table_info(enterprise_prices)')
    .all().some(c => c.name === 'price_basis');
  if (!hasBasis) {
    db.exec('ALTER TABLE enterprise_prices ADD COLUMN price_basis TEXT');
  }
  // Only fill rows that don't already carry a basis — never overwrite.
  db.prepare(
    "UPDATE enterprise_prices SET price_basis = ? WHERE enterprise = 'rooibos' AND price_basis IS NULL"
  ).run(ROOIBOS_PRICE_BASIS);
}

module.exports = { migrateEnterprisePriceBasis };
