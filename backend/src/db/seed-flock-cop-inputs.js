const { v4: uuidv4 } = require('uuid');

// Benchmark placeholders from the Land Bank "Extensive Dual Sheep — Merino"
// 2024/25 enterprise budget (R/ewe figures scaled to head count), with
// class adjustments. These are ESTIMATES flagged via source so Alex overwrites
// them with Cloudskraal actuals. See docs/research/livestock-cop-inputs-2026-06.md.
//
// Keyed by livestock_group name. Only groups present in the DB get a row.
const SOURCE = 'benchmark_landbank_2024_25';
const YEAR = 2025;

const BENCHMARKS = {
  // Full dual-Merino budget — the flock the Land Bank model directly represents.
  'Breeding Ewes 2025': {
    ewes_mated: 450,
    weaning_pct: 130,                 // Dohne benchmark (LB's own 80% is conservative)
    greasy_fleece_kg_per_head: 5.5,
    clean_yield_pct: 68,
    liveweight_sold_kg_total: 17500,  // ~500 weaners × ~35 kg
    feed_cost: 112500,                // R250/ewe × 450
    labour_cost: 78300,               // R174 × 450
    animal_health_cost: 76500,        // R170 × 450
    shearing_cost: 6750,              // ~R15 × 450
    other_direct_cost: 77850,         // ~R173 × 450 (fuel+vermin+R&M+repl+mktg)
    wool_income: 715500,              // R1,590 × 450
    meat_income: 645750,              // R1,435 × 450
  },
  // Meat-focused finishing flock — no wool, no weaning.
  'Trading Lambs 2025': {
    ewes_mated: null,
    weaning_pct: null,
    greasy_fleece_kg_per_head: null,
    clean_yield_pct: null,
    liveweight_sold_kg_total: 4800,   // 120 × ~40 kg
    feed_cost: 48000,                 // ~R400/head finishing × 120
    labour_cost: 12000,
    animal_health_cost: 9600,
    shearing_cost: 0,
    other_direct_cost: 14400,
    wool_income: 0,
    meat_income: 338400,              // 4800 kg × ~R70.50/kg live
  },
  // Replacement ewes — wool + maintenance, not yet mated.
  'Young Ewes 2025': {
    ewes_mated: null,
    weaning_pct: null,
    greasy_fleece_kg_per_head: 5.0,
    clean_yield_pct: 68,
    liveweight_sold_kg_total: 0,
    feed_cost: 16000,
    labour_cost: 12000,
    animal_health_cost: 9600,
    shearing_cost: 1200,
    other_direct_cost: 12000,
    wool_income: 72000,
    meat_income: 0,
  },
  // Rams — cost centre, wool only.
  'Replacement Rams': {
    ewes_mated: null,
    weaning_pct: null,
    greasy_fleece_kg_per_head: 6.0,
    clean_yield_pct: 68,
    liveweight_sold_kg_total: 0,
    feed_cost: 7500,
    labour_cost: 1500,
    animal_health_cost: 3000,
    shearing_cost: 300,
    other_direct_cost: 3000,
    wool_income: 18000,
    meat_income: 0,
  },
};

function seedFlockCopInputs(db) {
  let existing;
  try {
    existing = db.prepare('SELECT COUNT(*) AS c FROM flock_cop_inputs').get().c;
  } catch (e) {
    console.log('flock_cop_inputs table not ready, skipping.');
    return;
  }
  if (existing > 0) {
    console.log('Flock COP inputs already seeded, skipping.');
    return;
  }

  const now = new Date().toISOString();
  const findGroup = db.prepare('SELECT id FROM livestock_groups WHERE name = ?');
  const insert = db.prepare(`
    INSERT INTO flock_cop_inputs (
      id, group_id, year, ewes_mated, weaning_pct, greasy_fleece_kg_per_head,
      clean_yield_pct, liveweight_sold_kg_total, feed_cost, labour_cost,
      animal_health_cost, shearing_cost, other_direct_cost, wool_income,
      meat_income, source, notes, created_at, updated_at
    ) VALUES (
      @id, @group_id, @year, @ewes_mated, @weaning_pct, @greasy_fleece_kg_per_head,
      @clean_yield_pct, @liveweight_sold_kg_total, @feed_cost, @labour_cost,
      @animal_health_cost, @shearing_cost, @other_direct_cost, @wool_income,
      @meat_income, @source, @notes, @created_at, @updated_at
    )
  `);

  let seeded = 0;
  const tx = db.transaction(() => {
    for (const [name, b] of Object.entries(BENCHMARKS)) {
      const group = findGroup.get(name);
      if (!group) continue; // flock not in this DB — skip silently
      insert.run({
        id: uuidv4(),
        group_id: group.id,
        year: YEAR,
        ...b,
        source: SOURCE,
        notes: 'Benchmark placeholder — overwrite with Cloudskraal actuals.',
        created_at: now,
        updated_at: now,
      });
      seeded++;
    }
  });
  tx();
  console.log(`  Seeded ${seeded} flock COP input rows (benchmark).`);
}

module.exports = { seedFlockCopInputs };
