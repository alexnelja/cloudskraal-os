// Spec 2i.2 — adds operating-rate columns to the equipment table on DBs created
// before they existed. Idempotent.
function migrateEquipmentRates(db) {
  const cols = db.prepare('PRAGMA table_info(equipment)').all().map(c => c.name);
  const add = (col, ddl) => { if (!cols.includes(col)) db.exec(`ALTER TABLE equipment ADD COLUMN ${ddl}`); };
  add('fuel_l_per_hour', 'fuel_l_per_hour REAL');
  add('annual_use_hours', 'annual_use_hours REAL');
  add('maintenance_zar_per_year', 'maintenance_zar_per_year REAL');
  add('kind', "kind TEXT DEFAULT 'machine'");
}

module.exports = { migrateEquipmentRates };
