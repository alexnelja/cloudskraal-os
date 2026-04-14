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

function seedEnterprisePrices(db) {
  try {
    const count = db.prepare(
      "SELECT COUNT(*) as c FROM enterprise_prices WHERE enterprise='rooibos'"
    ).get().c;
    if (count > 0) {
      console.log('Enterprise prices already seeded, skipping.');
      return;
    }
  } catch (e) {
    console.log('enterprise_prices table not ready, skipping.');
    return;
  }

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO enterprise_prices
      (id, enterprise, year, price_per_kg, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const [year, price] of ROOIBOS_FORECAST) {
      insert.run(uuidv4(), 'rooibos', year, price, null, now, now);
    }
  });
  tx();
  console.log(`  Seeded ${ROOIBOS_FORECAST.length} rooibos price rows.`);
}

module.exports = { seedEnterprisePrices };
