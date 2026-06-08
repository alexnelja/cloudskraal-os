// Spec 2f.3b — adds avg_weaning_weight_kg to breeding_seasons on DBs created
// before the column existed (init-phase2-schema already marked applied on live
// DBs). Idempotent.
function migrateBreedingWeaningWeight(db) {
  const hasCol = db.prepare('PRAGMA table_info(breeding_seasons)')
    .all().some(c => c.name === 'avg_weaning_weight_kg');
  if (!hasCol) {
    db.exec('ALTER TABLE breeding_seasons ADD COLUMN avg_weaning_weight_kg REAL');
  }
}

module.exports = { migrateBreedingWeaningWeight };
