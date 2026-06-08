const { v4: uuidv4 } = require('uuid');

// Conversion-factor chains per enterprise context. Base uom is harvest_wet_kg
// (generic raw-harvest kg). Seeded per-context independently so a new context
// (e.g. wine) still seeds on a DB where rooibos was already seeded.
const FACTORS = {
  rooibos: [
    ['harvest_wet_kg', 'dried_kg', 0.45, '2022-01-01', 'Typical drying shrink at Cloudskraal'],
    ['dried_kg', 'sifted_netto_dry_kg', 0.87, '2022-01-01', '87% netto + 9% stokke + 4% stof'],
  ],
  // 2g.1: grapes are sold as harvested (factor 1); the wine_litres/bottle hops
  // ready the chain for per-bottle COP in 2g.2.
  wine: [
    ['harvest_wet_kg', 'grape_kg', 1.0, '2022-01-01', 'Grapes sold as harvested'],
    ['grape_kg', 'wine_litres', 0.72, '2022-01-01', 'Grape kg → wine litres (typical extraction)'],
    ['wine_litres', 'bottle_750ml', 1.0 / 0.75, '2022-01-01', '1 bottle = 0.75 L'],
  ],
};

function seedContext(db, context, rows) {
  let count;
  try {
    count = db.prepare('SELECT COUNT(*) AS c FROM conversion_factors WHERE context = ?').get(context).c;
  } catch (e) {
    console.log('conversion_factors table not ready, skipping.');
    return;
  }
  if (count > 0) return; // already seeded for this context

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO conversion_factors
      (id, from_uom, to_uom, context, factor, effective_from, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const [from, to, factor, eff, notes] of rows) {
      insert.run(uuidv4(), from, to, context, factor, eff, notes, now, now);
    }
  });
  tx();
  console.log(`  Seeded ${rows.length} ${context} conversion factors.`);
}

function seedConversionFactors(db) {
  for (const [context, rows] of Object.entries(FACTORS)) {
    seedContext(db, context, rows);
  }
}

module.exports = { seedConversionFactors };
