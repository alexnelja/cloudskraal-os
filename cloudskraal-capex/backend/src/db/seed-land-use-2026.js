const { v4: uuidv4 } = require('uuid');

/**
 * Reconciles field land use assignments for 2026 season.
 * Source: Cloudskraal farm management tool (October 2025 planning).
 *
 * This updates planted_year, enterprise, crop_type, area_ha, and status
 * for all fields based on actual 2026 farm planning data.
 */
function seedLandUse2026(db) {
  try {
    const check = db.prepare(
      "SELECT COUNT(*) as c FROM fields WHERE crop_type = 'lupine_fourrages'"
    ).get().c;
    if (check > 0) {
      console.log('Land use 2026 already reconciled, skipping.');
      return;
    }
  } catch (e) {
    console.log('Fields table not ready, skipping land use seed.');
    return;
  }

  console.log('Reconciling 2026 land use assignments...');
  const now = new Date().toISOString();

  // ═══════════════════════════════════════════════════════════════════════
  // Field assignments by category
  // ═══════════════════════════════════════════════════════════════════════

  const assignments = [
    // ROOIBOS 2022 (145 ha) — Year 4, declining
    { code: 'B12', planted: '2022', enterprise: 'rooibos', ha: 21.21 },
    { code: 'B1', planted: '2022', enterprise: 'rooibos', ha: 21.14 },
    { code: 'B4', planted: '2022', enterprise: 'rooibos', ha: 20.27 },
    { code: 'B5', planted: '2022', enterprise: 'rooibos', ha: 17.11 },
    { code: 'C11', planted: '2022', enterprise: 'rooibos', ha: 35.13 },
    { code: 'C6', planted: '2022', enterprise: 'rooibos', ha: 8.531 },
    { code: 'C8', planted: '2022', enterprise: 'rooibos', ha: 21.66 },

    // ROOIBOS 2023 (92.5 ha) — Year 3, peak production
    { code: 'C12', planted: '2023', enterprise: 'rooibos', ha: 20.64 },
    { code: 'C16', planted: '2023', enterprise: 'rooibos', ha: 8.386 },
    { code: 'C19', planted: '2023', enterprise: 'rooibos', ha: 33.53 },
    { code: 'GA7', planted: '2023', enterprise: 'rooibos', ha: 16.71 },

    // ROOIBOS 2024 (53.88 ha) — Year 2, first full harvest
    { code: 'C2', planted: '2024', enterprise: 'rooibos', ha: 19.62 },
    { code: 'C5', planted: '2024', enterprise: 'rooibos', ha: 34.26 },

    // ROOIBOS 2025 (113.4 ha) — Year 1, topping in Apr 2026
    { code: 'C18', planted: '2025', enterprise: 'rooibos', ha: 22.93 },
    { code: 'C7', planted: '2025', enterprise: 'rooibos', ha: 29.65 },
    { code: 'G3', planted: '2025', enterprise: 'rooibos', ha: 54.64 },
    { code: 'GA9', planted: '2025', enterprise: 'rooibos', ha: 6.166 },

    // ROOIBOS 2026 (285.2 ha) — New planting Jul-Sep 2026
    { name: 'Almond Orchard', planted: '2026', enterprise: 'rooibos', ha: 2.324 },
    { code: 'B2', planted: '2026', enterprise: 'rooibos', ha: 18.34 },
    { code: 'B3', planted: '2026', enterprise: 'rooibos', ha: 32.77 },
    { code: 'C9', planted: '2026', enterprise: 'rooibos', ha: 30.47 },
    { code: 'G11', planted: '2026', enterprise: 'rooibos', ha: 15.09 },
    { code: 'G13', planted: '2026', enterprise: 'rooibos', ha: 21.95 },
    { code: 'G14', planted: '2026', enterprise: 'rooibos', ha: 7.031 },
    { code: 'G1', planted: '2026', enterprise: 'rooibos', ha: 17.71 },
    { code: 'G2a', planted: '2026', enterprise: 'rooibos', ha: 29.87 },
    { code: 'G6', planted: '2026', enterprise: 'rooibos', ha: 52.84 },
    { code: 'G7c', planted: '2026', enterprise: 'rooibos', ha: 7.93 },
    { code: 'GA10', planted: '2026', enterprise: 'rooibos', ha: 9.992 },

    // LUPIN: FOURRAGES 2026 (256.5 ha) — sheep feed, soil recovery
    { code: 'B13', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 8.94 },
    { code: 'B17', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 14.56 },
    { code: 'B7', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 11.8 },
    { code: 'B8', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 23.79 },
    { code: 'C13', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 27.22 },
    { code: 'C17', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 13.97 },
    { code: 'C4', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 14.13 },
    { code: 'G10', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 11.99 },
    { code: 'G12', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 4.799 },
    { code: 'G15', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 29.23 },
    { code: 'G2b', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 17.13 },
    { code: 'G4', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 54.62 },
    { code: 'G9', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 18.23 },
    { code: 'GA.1', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 1.032 },
    { code: 'GA3', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 3.075 },
    { name: 'Pierre Los buchu', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 1.271 },
    { name: 'Pierre Treinspoor', enterprise: 'lupines', cropType: 'lupine_fourrages', ha: 0.7155 },

    // LUPINE: TROCKEN after lease 2028 (159.7 ha)
    { name: 'Pierre Boorgat', enterprise: 'lupines', cropType: 'lupine_trocken_2028', ha: 6.133 },
    { name: 'Pierre By die Stoor', enterprise: 'lupines', cropType: 'lupine_trocken_2028', ha: 35.28 },
    { name: 'Pierre Wild kamp', enterprise: 'lupines', cropType: 'lupine_trocken_2028', ha: 0.8422 },
    // Klippe Rivier fields — may need to be created if not in DB
    { name: 'Klippe Rivier Bo', enterprise: 'lupines', cropType: 'lupine_trocken_2028', ha: 21.05, createIfMissing: true, farmCode: 'kromvlei' },
    { name: 'Klippe Rivier Onder', enterprise: 'lupines', cropType: 'lupine_trocken_2028', ha: 44.38, createIfMissing: true, farmCode: 'kromvlei' },
    { name: 'Klipriver Middel', enterprise: 'lupines', cropType: 'lupine_trocken_2028', ha: 52, createIfMissing: true, farmCode: 'kromvlei' },

    // OATS: FODDER/FORAGE 2026 (115.1 ha)
    { code: 'C15', enterprise: 'oats', cropType: 'oats_fodder', ha: 7.957 },
    { code: 'C3', enterprise: 'oats', cropType: 'oats_fodder', ha: 30.7 },
    { code: 'G8', enterprise: 'oats', cropType: 'oats_fodder', ha: 68.11 },
    { code: 'GA2', enterprise: 'oats', cropType: 'oats_fodder', ha: 2.348 },
    { code: 'GA8', enterprise: 'oats', cropType: 'oats_fodder', ha: 5.969 },

    // FALLOW-LAND Braak (37.45 ha)
    { code: 'B10', enterprise: 'fallow', ha: 16.48, status: 'fallow' },
    { code: 'G7a', enterprise: 'fallow', ha: 8.846, status: 'fallow' },
    { code: 'G7b', enterprise: 'fallow', ha: 10.24, status: 'fallow' },
    { code: 'GA6', enterprise: 'fallow', ha: 1.888, status: 'fallow' },
  ];

  const updateByCode = db.prepare(`
    UPDATE fields SET planted_year = ?, enterprise = ?, crop_type = ?, area_ha = ?, status = ?, updated_at = ?
    WHERE code = ?
  `);

  const updateByName = db.prepare(`
    UPDATE fields SET planted_year = ?, enterprise = ?, crop_type = ?, area_ha = ?, status = ?, updated_at = ?
    WHERE name = ?
  `);

  const insertField = db.prepare(`
    INSERT INTO fields (id, farm_id, name, code, enterprise, crop_type, area_ha, status, geometry, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', '{}', ?, ?)
  `);

  const seedAll = db.transaction(() => {
    let updated = 0, created = 0, notFound = 0;

    for (const a of assignments) {
      const planted = a.planted || null;
      const cropType = a.cropType || (a.enterprise === 'rooibos' ? 'rooibos' : null);
      const status = a.status || 'active';

      let found = false;
      if (a.code) {
        const result = updateByCode.run(planted, a.enterprise, cropType, a.ha, status, now, a.code);
        found = result.changes > 0;
      }
      if (!found && a.name) {
        const result = updateByName.run(planted, a.enterprise, cropType, a.ha, status, now, a.name);
        found = result.changes > 0;
      }

      if (found) {
        updated++;
      } else if (a.createIfMissing && a.farmCode) {
        const farm = db.prepare('SELECT id FROM farms WHERE code = ?').get(a.farmCode);
        if (farm) {
          insertField.run(uuidv4(), farm.id, a.name, null, a.enterprise, cropType, a.ha, now, now);
          created++;
        } else {
          notFound++;
        }
      } else {
        notFound++;
      }
    }

    // Deduplicate fields with same name
    const dups = db.prepare(`
      SELECT name, COUNT(*) as c FROM fields GROUP BY name HAVING c > 1
    `).all();

    let deduped = 0;
    for (const d of dups) {
      const ids = db.prepare('SELECT id FROM fields WHERE name = ? ORDER BY ROWID').all(d.name);
      for (let i = 1; i < ids.length; i++) {
        db.prepare('DELETE FROM fields WHERE id = ?').run(ids[i].id);
        deduped++;
      }
    }

    console.log(`  Updated: ${updated}`);
    console.log(`  Created: ${created}`);
    console.log(`  Not found: ${notFound}`);
    console.log(`  Deduplicated: ${deduped}`);
  });

  seedAll();
  console.log('Land use 2026 reconciliation complete.');
}

module.exports = { seedLandUse2026 };
