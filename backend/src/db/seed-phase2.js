const { v4: uuidv4 } = require('uuid');

function seedPhase2(db) {
  // Skip if already seeded
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM equipment').get().c;
    if (count > 0) {
      console.log('Phase 2 already seeded, skipping.');
      return;
    }
  } catch (e) {
    console.log('Phase 2 tables not ready, skipping seed.');
    return;
  }

  console.log('Seeding Phase 2: equipment, livestock, production...');
  const now = new Date().toISOString();

  // Look up farm IDs
  const garsland = db.prepare("SELECT id FROM farms WHERE code = ?").get('garsland');
  const cloudskraal = db.prepare("SELECT id FROM farms WHERE code = ?").get('cloudskraal');
  const garslandId = garsland ? garsland.id : null;
  const cloudskraalId = cloudskraal ? cloudskraal.id : null;

  // Look up a Cloudskraal field for livestock location
  const anyField = db.prepare("SELECT id FROM fields WHERE farm_id = ? LIMIT 1").get(cloudskraalId);
  const fieldId = anyField ? anyField.id : null;

  const seedAll = db.transaction(() => {
    // ── EQUIPMENT ──────────────────────────────────────────────────────────────

    const insertEquip = db.prepare(`
      INSERT INTO equipment (id, name, code, type, make, model, year, farm_id, department,
        purchase_date, purchase_price, current_value, depreciation_method, useful_life_years,
        salvage_value, status, hours_meter, odometer_km, next_service_date, next_service_hours,
        notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const bovicIds = [];
    const bovicDefaults = {
      type: 'processing', make: 'Bovic', model: null, year: null, department: 'rooibos',
      purchase_price: 45000, current_value: 30000, depreciation_method: 'straight_line',
      useful_life_years: 15, salvage_value: 2000, status: 'active',
      hours_meter: null, odometer_km: null, next_service_date: '2026-06-01', next_service_hours: null,
    };

    // Bovic Cutters 1-3 (Garsland)
    for (let i = 1; i <= 3; i++) {
      const id = uuidv4();
      bovicIds.push(id);
      insertEquip.run(id, `Bovic Cutter ${i}`, `BC-${i}`, bovicDefaults.type, bovicDefaults.make,
        bovicDefaults.model, bovicDefaults.year, garslandId, bovicDefaults.department,
        null, bovicDefaults.purchase_price, bovicDefaults.current_value, bovicDefaults.depreciation_method,
        bovicDefaults.useful_life_years, bovicDefaults.salvage_value, bovicDefaults.status,
        bovicDefaults.hours_meter, bovicDefaults.odometer_km, bovicDefaults.next_service_date,
        bovicDefaults.next_service_hours, null, now, now);
    }

    // Bovic Cutters 4-5 (Cloudskraal)
    for (let i = 4; i <= 5; i++) {
      const id = uuidv4();
      insertEquip.run(id, `Bovic Cutter ${i}`, `BC-${i}`, bovicDefaults.type, bovicDefaults.make,
        bovicDefaults.model, bovicDefaults.year, cloudskraalId, bovicDefaults.department,
        null, bovicDefaults.purchase_price, bovicDefaults.current_value, bovicDefaults.depreciation_method,
        bovicDefaults.useful_life_years, bovicDefaults.salvage_value, bovicDefaults.status,
        bovicDefaults.hours_meter, bovicDefaults.odometer_km, bovicDefaults.next_service_date,
        bovicDefaults.next_service_hours, null, now, now);
    }

    // Victor Cutters
    for (let i = 1; i <= 2; i++) {
      insertEquip.run(uuidv4(), `Victor Cutter ${i}`, `VC-${i}`, 'processing', 'Victor',
        null, null, garslandId, 'rooibos',
        null, 35000, 22000, 'straight_line', 15, 1500, 'active',
        null, null, '2026-06-01', null, null, now, now);
    }

    // Massey Ferguson 290
    insertEquip.run(uuidv4(), 'Massey Ferguson 290', 'MF-290', 'tractor', 'Massey Ferguson',
      '290', 2018, cloudskraalId, null,
      '2018-03-15', 450000, 280000, 'straight_line', 20, 50000, 'active',
      3200, null, '2026-05-01', 3500, null, now, now);

    // Toyota Hilux
    insertEquip.run(uuidv4(), 'Toyota Hilux', 'TH-01', 'vehicle', 'Toyota',
      'Hilux', 2020, cloudskraalId, null,
      '2020-06-01', 380000, 250000, 'straight_line', 10, 80000, 'active',
      null, 85000, '2026-04-15', null, null, now, now);

    // Forklift
    insertEquip.run(uuidv4(), 'Forklift', 'FL-01', 'tool', null,
      null, null, garslandId, 'rooibos',
      null, 180000, 120000, 'straight_line', 15, 10000, 'active',
      1800, null, '2026-07-01', 2000, null, now, now);

    // Sifting Machine
    insertEquip.run(uuidv4(), 'Sifting Machine', 'SM-01', 'processing', null,
      null, null, garslandId, 'rooibos',
      null, 95000, 65000, 'straight_line', 15, 5000, 'active',
      null, null, '2026-06-01', null, null, now, now);

    // Masatec Platform Scale
    insertEquip.run(uuidv4(), 'Masatec Platform Scale', 'MS-01', 'tool', 'Masatec',
      null, null, garslandId, 'rooibos',
      null, 60000, 45000, 'straight_line', 20, 3000, 'active',
      null, null, null, null, null, now, now);

    // ── MAINTENANCE LOGS ────────────────────────────────────────────────────────

    const insertMaint = db.prepare(`
      INSERT INTO maintenance_logs (id, equipment_id, type, date, description, cost,
        performed_by, hours_at_service, parts_used, next_due_date, next_due_hours, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const bovicCutter1 = bovicIds[0];

    insertMaint.run(uuidv4(), bovicCutter1, 'scheduled', '2025-12-01',
      'Annual service and blade inspection', 1200, 'Johan',
      null, JSON.stringify(['oil filter', 'belts']), '2026-06-01', null, null, now);

    insertMaint.run(uuidv4(), bovicCutter1, 'scheduled', '2026-01-15',
      'Blade replacement — cutting edges worn', 3500, 'Johan',
      null, JSON.stringify(['cutting blade set x2']), null, null,
      'Replaced both cutting blades after 2025 season', now);

    insertMaint.run(uuidv4(), bovicCutter1, 'inspection', '2026-03-01',
      'Pre-season inspection — all clear', 0, 'Pieter',
      null, null, null, null, 'Ready for 2026 season', now);

    // ── LIVESTOCK GROUPS ────────────────────────────────────────────────────────

    const insertGroup = db.prepare(`
      INSERT INTO livestock_groups (id, name, enterprise, species, breed, management_type,
        head_count, current_field_id, average_weight_kg, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const breedingEwesId = uuidv4();
    insertGroup.run(breedingEwesId, 'Breeding Ewes 2025', 'sheep', 'sheep', 'merino',
      'breeding', 450, fieldId, 55, null, now, now);

    const ramsId = uuidv4();
    insertGroup.run(ramsId, 'Replacement Rams', 'sheep', 'sheep', 'merino',
      'stud', 15, fieldId, 85, null, now, now);

    const tradingLambsId = uuidv4();
    insertGroup.run(tradingLambsId, 'Trading Lambs 2025', 'sheep', 'sheep', 'merino',
      'trading', 120, fieldId, 30, null, now, now);

    const youngEwesId = uuidv4();
    insertGroup.run(youngEwesId, 'Young Ewes 2025', 'sheep', 'sheep', 'merino',
      'breeding', 80, fieldId, 42, null, now, now);

    // ── BREEDING SEASON ─────────────────────────────────────────────────────────

    const insertBreeding = db.prepare(`
      INSERT INTO breeding_seasons (id, group_id, year, joining_start, joining_end, rams_used,
        ewes_joined, scanning_date, pregnant_count, dry_count, singles_count, twins_count,
        triplets_count, lambing_start, lambing_end, born_count, survived_count, weaned_count,
        weaning_date, weaning_percentage, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertBreeding.run(uuidv4(), breedingEwesId, 2025,
      '2025-12-03', '2025-12-20', 15, 450,
      '2026-02-15', 410, 40, 280, 120, 10,
      '2026-05-17', '2026-07-15', 550, 510, 480,
      '2026-09-01', 106.7,
      null, now, now);

    // ── SHEARING ────────────────────────────────────────────────────────────────

    const insertShearing = db.prepare(`
      INSERT INTO shearing_records (id, group_id, date, head_shorn, total_fleece_kg,
        avg_fleece_kg, micron_avg, yield_pct, vegetable_matter, staple_length_mm,
        grade, buyer, price_per_kg, total_revenue, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertShearing.run(uuidv4(), breedingEwesId, '2025-09-15',
      580, 2610, 4.5, 19.5, 65, 1.8, 85,
      'Good', 'BKB Ltd', 249, 650000, null, now);

    // ── PRODUCTION BATCHES ──────────────────────────────────────────────────────

    const insertBatch = db.prepare(`
      INSERT INTO production_batches (id, batch_code, enterprise, product_type,
        harvest_date_start, harvest_date_end, initial_quantity_kg, current_quantity_kg, status,
        quality_grade, storage_location, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertStep = db.prepare(`
      INSERT INTO processing_steps (id, batch_id, step_number, step_type, start_datetime,
        end_datetime, facility, equipment_id, operator, input_quantity_kg, output_quantity_kg,
        loss_kg, loss_reason, parameters, quality_check_passed, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertQuality = db.prepare(`
      INSERT INTO quality_tests (id, batch_id, test_type, test_date, tested_by, results,
        pass_fail, certificate_number, lab_reference, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSale = db.prepare(`
      INSERT INTO sales (id, batch_id, customer, quantity_kg, unit_price, total_amount,
        currency, export_destination, invoice_number, shipped_date, paid_date, status,
        notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Batch BF-2026-001
    const batch1Id = uuidv4();
    insertBatch.run(batch1Id, 'BF-2026-001', 'rooibos', 'rooibos_oxidized',
      '2026-01-10', '2026-01-25', 8000, 7600, 'stored',
      'Choice', 'Garsland Warehouse', null, now, now);

    // Processing steps for batch 1
    const batch1Steps = [
      { num: 1, type: 'cutting', start: '2026-01-10T06:00:00', end: '2026-01-10T18:00:00', inKg: 8000, outKg: 7950, loss: 50, reason: 'field waste', params: null },
      { num: 2, type: 'bruising', start: '2026-01-11T06:00:00', end: '2026-01-11T12:00:00', inKg: 7950, outKg: 7940, loss: 10, reason: null, params: null },
      { num: 3, type: 'oxidation', start: '2026-01-11T14:00:00', end: '2026-01-12T00:00:00', inKg: 7940, outKg: 7900, loss: 40, reason: 'moisture evaporation', params: JSON.stringify({ temp: 35, humidity: 80, duration_hrs: 10 }) },
      { num: 4, type: 'drying', start: '2026-01-12T06:00:00', end: '2026-01-14T06:00:00', inKg: 7900, outKg: 7700, loss: 200, reason: 'moisture loss', params: JSON.stringify({ duration_hrs: 48 }) },
      { num: 5, type: 'sifting', start: '2026-01-15T06:00:00', end: '2026-01-15T18:00:00', inKg: 7700, outKg: 7650, loss: 50, reason: 'dust and fines', params: null },
      { num: 6, type: 'grading', start: '2026-01-16T06:00:00', end: '2026-01-16T12:00:00', inKg: 7650, outKg: 7600, loss: 50, reason: 'rejects', params: null },
    ];

    for (const s of batch1Steps) {
      insertStep.run(uuidv4(), batch1Id, s.num, s.type, s.start, s.end,
        'Garsland Processing', null, null, s.inKg, s.outKg, s.loss, s.reason, s.params, 1, null, now);
    }

    // Quality test for batch 1
    insertQuality.run(uuidv4(), batch1Id, 'sensory', '2026-01-17', 'Johan',
      JSON.stringify({ colour: 8, aroma: 7, flavour: 8, moisture_pct: 8.5 }),
      'pass', null, null, null, now);

    // Sale for batch 1
    insertSale.run(uuidv4(), batch1Id, 'CNAS', 7600, 40, 304000,
      'ZAR', null, 'INV-2026-001', null, null, 'invoiced', null, now, now);

    // Batch BF-2026-002
    const batch2Id = uuidv4();
    insertBatch.run(batch2Id, 'BF-2026-002', 'rooibos', 'rooibos_oxidized',
      '2026-01-28', null, 12000, 11800, 'processing',
      null, null, null, now, now);

    // Processing steps for batch 2 (partially complete)
    insertStep.run(uuidv4(), batch2Id, 1, 'cutting', '2026-01-28T06:00:00', '2026-01-28T18:00:00',
      'Garsland Processing', null, null, 12000, 11950, 50, 'field waste', null, 1, null, now);
    insertStep.run(uuidv4(), batch2Id, 2, 'bruising', '2026-01-29T06:00:00', '2026-01-29T12:00:00',
      'Garsland Processing', null, null, 11950, 11920, 30, null, null, 1, null, now);
    insertStep.run(uuidv4(), batch2Id, 3, 'oxidation', '2026-01-29T14:00:00', null,
      'Garsland Processing', null, null, 11920, null, null, null,
      JSON.stringify({ temp: 35, humidity: 80, duration_hrs: 10 }), null, 'In progress', now);

    // Batch WC-2026-001 (wool clip)
    const batch3Id = uuidv4();
    insertBatch.run(batch3Id, 'WC-2026-001', 'sheep', 'wool_clip',
      '2025-09-15', '2025-09-15', 2610, 0, 'sold',
      null, null, null, now, now);

    // Sale for wool clip
    insertSale.run(uuidv4(), batch3Id, 'BKB Ltd', 2610, 249, 650000,
      'ZAR', null, 'INV-2025-WOOL-001', '2025-10-01', '2025-11-15', 'paid', null, now, now);

    console.log('  Equipment: 12');
    console.log('  Maintenance logs: 3');
    console.log('  Livestock groups: 4');
    console.log('  Breeding seasons: 1');
    console.log('  Shearing records: 1');
    console.log('  Production batches: 3');
    console.log('  Processing steps: 9');
    console.log('  Quality tests: 1');
    console.log('  Sales: 2');
  });

  seedAll();
  console.log('Phase 2 seed complete.');
}

module.exports = { seedPhase2 };
