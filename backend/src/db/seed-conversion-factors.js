const { v4: uuidv4 } = require('uuid');

function seedConversionFactors(db) {
  try {
    const count = db.prepare(
      "SELECT COUNT(*) as c FROM conversion_factors WHERE context=? AND effective_from=?"
    ).get('rooibos', '2022-01-01').c;
    if (count > 0) {
      console.log('Conversion factors already seeded, skipping.');
      return;
    }
  } catch (e) {
    console.log('conversion_factors table not ready, skipping.');
    return;
  }

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO conversion_factors
      (id, from_uom, to_uom, context, factor, effective_from, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const rows = [
    ['harvest_wet_kg', 'dried_kg', 'rooibos', 0.45, '2022-01-01',
      'Typical drying shrink at Cloudskraal'],
    ['dried_kg', 'sifted_netto_dry_kg', 'rooibos', 0.87, '2022-01-01',
      '87% netto + 9% stokke + 4% stof'],
  ];

  const tx = db.transaction(() => {
    for (const [from, to, ctx, factor, eff, notes] of rows) {
      insert.run(uuidv4(), from, to, ctx, factor, eff, notes, now, now);
    }
  });
  tx();
  console.log(`  Seeded ${rows.length} rooibos conversion factors.`);
}

module.exports = { seedConversionFactors };
