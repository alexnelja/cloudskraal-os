const { v4: uuidv4 } = require('uuid');
const { isValidUsage } = require('../services/usage');

function canonicalUsage(enterprise, crop_type) {
  if (enterprise === 'rooibos') return 'rooibos';
  if (enterprise === 'lupines') return 'lupines_fourrages';
  if (enterprise === 'oats') return 'oats';
  if (enterprise === 'fallow') return 'fallow';
  if (enterprise === 'almond' || crop_type === 'almond') return 'almond';
  return null;
}

function seedUsagePeriods(db) {
  try {
    const check = db.prepare('SELECT COUNT(*) as c FROM field_usage_period').get().c;
    if (check > 0) {
      console.log('Usage periods already seeded, skipping.');
      return;
    }
  } catch (e) {
    console.log('field_usage_period table not ready, skipping usage seed.');
    return;
  }

  console.log('Seeding field_usage_period (2026 + rooibos backfill)...');
  const now = new Date().toISOString();

  const fields = db.prepare(`
    SELECT id, enterprise, crop_type, planted_year, area_ha
      FROM fields
     WHERE enterprise IS NOT NULL AND enterprise != 'unclassified'
  `).all();

  const insert = db.prepare(`
    INSERT INTO field_usage_period
      (id, field_id, usage, start_date, end_date, planted_date, rotation_year,
       source, notes, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `);

  const existsAt = db.prepare(`
    SELECT id FROM field_usage_period
     WHERE field_id = ? AND start_date = ? AND deleted_at IS NULL
  `);

  const tx = db.transaction((rows) => {
    let inserted = 0;
    let skipped = 0;
    for (const f of rows) {
      const usage = canonicalUsage(f.enterprise, f.crop_type);
      if (!usage || !isValidUsage(usage)) {
        skipped++;
        continue;
      }

      let startDate;
      let plantedDate = null;
      let source;
      if (usage === 'rooibos' && f.planted_year && parseInt(f.planted_year) < 2026) {
        startDate = `${f.planted_year}-01-01`;
        plantedDate = startDate;
        source = 'seed-rooibos-backfill';
      } else {
        startDate = '2026-01-01';
        plantedDate = f.planted_year ? `${f.planted_year}-01-01` : null;
        source = 'seed-2026';
      }

      if (existsAt.get(f.id, startDate)) {
        skipped++;
        continue;
      }

      insert.run(
        uuidv4(), f.id, usage, startDate, null, plantedDate, null,
        source, null, now, now
      );
      inserted++;
    }
    console.log(`  Usage periods: inserted ${inserted}, skipped ${skipped}.`);
  });

  tx(fields);
}

module.exports = { seedUsagePeriods };
