const { v4: uuidv4 } = require('uuid');

// Rooibos forecast curve per Alex (memory: project_cloudskraal_price_forecast).
// Absolute years are correct here — the forecast is *for* these specific years.
// Display code windows relative to todayUTC().
const ROOIBOS_FORECAST = [
  [2026, 40],
  [2027, 46],
  [2028, 55],
  [2029, 45],
  [2030, 39],
];

// The basis the rooibos forecast price is quoted on: sale-ready sifted netto-dry
// tea. Margin uses this to convert COP cost (harvest-wet) onto the same kg.
const ROOIBOS_PRICE_BASIS = 'sifted_netto_dry_kg';

// 2g.1: Cloudskraal sells wine grapes per kg. Benchmark placeholder (WC wine
// grapes ~R8–11/kg, 2024) — overwrite with the actual co-op/cellar price.
const WINE_GRAPE_FORECAST = [
  [2026, 9],
  [2027, 9.5],
  [2028, 10],
  [2029, 10.5],
  [2030, 11],
];
const WINE_PRICE_BASIS = 'grape_kg';

const PRICES = {
  rooibos: { rows: ROOIBOS_FORECAST, basis: ROOIBOS_PRICE_BASIS, note: null },
  wine: { rows: WINE_GRAPE_FORECAST, basis: WINE_PRICE_BASIS, note: 'benchmark — replace with actual grape price' },
};

function seedEnterprise(db, enterprise, { rows, basis, note }) {
  let count;
  try {
    count = db.prepare('SELECT COUNT(*) AS c FROM enterprise_prices WHERE enterprise = ?').get(enterprise).c;
  } catch (e) {
    console.log('enterprise_prices table not ready, skipping.');
    return;
  }
  if (count > 0) return; // already seeded for this enterprise

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO enterprise_prices
      (id, enterprise, year, price_per_kg, price_basis, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const [year, price] of rows) {
      insert.run(uuidv4(), enterprise, year, price, basis, note, now, now);
    }
  });
  tx();
  console.log(`  Seeded ${rows.length} ${enterprise} price rows.`);
}

function seedEnterprisePrices(db) {
  for (const [enterprise, cfg] of Object.entries(PRICES)) {
    seedEnterprise(db, enterprise, cfg);
  }
}

module.exports = { seedEnterprisePrices };
