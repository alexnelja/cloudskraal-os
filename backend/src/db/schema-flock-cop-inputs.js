// Spec 2f.1 — Livestock COP inputs. One row per flock (livestock_group) per year,
// capturing the high-signal cost buckets + production drivers a future
// computeFlockCop reads. Percentages are stored as percentages (130 = 130%).
function initFlockCopInputsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS flock_cop_inputs (
      id            TEXT PRIMARY KEY,
      group_id      TEXT NOT NULL REFERENCES livestock_groups(id) ON DELETE CASCADE,
      year          INTEGER NOT NULL,

      -- production drivers
      ewes_mated                INTEGER,
      weaning_pct               REAL,
      greasy_fleece_kg_per_head REAL,
      clean_yield_pct           REAL,
      liveweight_sold_kg_total  REAL,

      -- cost buckets (ZAR / year) — feed + labour + health ≈ 80% of COP signal
      feed_cost           REAL,
      labour_cost         REAL,
      animal_health_cost  REAL,
      shearing_cost       REAL,
      other_direct_cost   REAL,

      -- income (drives wool/meat joint-cost allocation downstream)
      wool_income         REAL,
      meat_income         REAL,

      -- provenance: 'benchmark_landbank_2024_25' | 'actual' | ...
      source        TEXT,
      notes         TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_flock_cop_inputs_unique
      ON flock_cop_inputs(group_id, year);
    CREATE INDEX IF NOT EXISTS idx_flock_cop_inputs_group
      ON flock_cop_inputs(group_id);
  `);
}

module.exports = { initFlockCopInputsSchema };
