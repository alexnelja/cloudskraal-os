/**
 * Migration: reclassify fields over 100 ha as farm_boundary.
 *
 * Rooibos fields in the Cederberg are typically 5-80 ha. Any "field" over
 * ~100 ha is almost certainly a camp/paddock boundary (or the whole farm
 * outline), not an individual planting block.
 *
 * This migration sets enterprise = 'farm_boundary' for every field whose
 * area_ha >= 100. It is idempotent — running it multiple times is safe.
 */

const AREA_THRESHOLD_HA = 100;

function migrateReclassifyLargeFields(db) {
  const stmt = db.prepare(`
    UPDATE fields
       SET enterprise  = 'farm_boundary',
           updated_at  = datetime('now')
     WHERE area_ha >= ?
       AND enterprise != 'farm_boundary'
  `);

  const result = stmt.run(AREA_THRESHOLD_HA);

  if (result.changes > 0) {
    // Log what was reclassified (for audit trail)
    const affected = db.prepare(`
      SELECT name, area_ha, enterprise FROM fields
       WHERE area_ha >= ? AND enterprise = 'farm_boundary'
       ORDER BY area_ha DESC
    `).all(AREA_THRESHOLD_HA);

    for (const f of affected) {
      console.log(
        `[migrate-reclassify] ${f.name} (${f.area_ha} ha) → farm_boundary`
      );
    }
    console.log(
      `[migrate-reclassify] reclassified ${result.changes} field(s) as farm_boundary`
    );
  }

  return result.changes;
}

module.exports = { migrateReclassifyLargeFields, AREA_THRESHOLD_HA };
