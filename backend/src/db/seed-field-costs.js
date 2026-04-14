const { v4: uuidv4 } = require('uuid');

/**
 * Seeds realistic field-level cost data:
 * - Inventory transactions (inputs applied to fields)
 * - Time entries (labour on specific fields)
 * - Tasks with task_inputs linked to fields
 *
 * Uses actual field IDs from the seeded farms/fields data.
 */
function seedFieldCosts(db) {
  // Check if already seeded (look for field-linked inventory transactions)
  try {
    const count = db.prepare(
      "SELECT COUNT(*) as c FROM inventory_transactions WHERE field_id IS NOT NULL"
    ).get().c;
    if (count > 0) {
      console.log('Field costs already seeded, skipping.');
      return;
    }
  } catch (e) {
    console.log('Field cost tables not ready, skipping seed.');
    return;
  }

  console.log('Seeding field-level cost data (inputs, labour, tasks)...');
  const now = new Date().toISOString();

  // --- Look up field IDs by code ---
  const fieldByCode = (code) => {
    const row = db.prepare('SELECT id, name, area_ha, farm_id FROM fields WHERE code = ?').get(code);
    return row || null;
  };

  // --- Look up product IDs ---
  const productByName = (name) => {
    const row = db.prepare('SELECT id, cost_per_unit FROM input_products WHERE name = ?').get(name);
    return row || null;
  };

  // --- Look up employee IDs ---
  const employeeByName = (name) => {
    const row = db.prepare('SELECT id, hourly_rate, monthly_salary FROM employees WHERE name = ?').get(name);
    return row || null;
  };

  // Fetch key references
  const lime = productByName('Agricultural Lime');
  const kcl = productByName('Potassium Chloride (KCl)');
  const glyphosate = productByName('Glyphosate');
  const diesel = productByName('Diesel');
  const seed = productByName('Rooibos Seed');

  const japie = employeeByName('Japie Nel');
  const appie = employeeByName('Appie Swarts');
  const adrie = employeeByName('Adrie Basson');

  // Rooibos fields to seed data for (Cloudskraal + Biekoes + Glenridge)
  const fieldCodes = [
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10',
    'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
    'G1', 'G2', 'G3',
    'GA1', 'GA2', 'GA3',
  ];

  const fields = fieldCodes.map(code => ({ code, ...fieldByCode(code) })).filter(f => f.id);

  if (fields.length === 0) {
    console.log('  No fields found by code, skipping field cost seed.');
    return;
  }

  const insertTx = db.prepare(`
    INSERT INTO inventory_transactions (id, product_id, type, date, quantity,
      unit_cost, total_cost, field_id, task_id, recorded_by, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTime = db.prepare(`
    INSERT INTO time_entries (id, employee_id, date, clock_in, clock_out,
      hours_worked, activity_type, enterprise, field_id, task_id, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, title, description, enterprise, field_id, type, status, priority,
      due_date, completed_date, completed_by, assigned_to, depends_on_task_id,
      recurrence_rule, calendar_event_id, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTaskInput = db.prepare(`
    INSERT INTO task_inputs (id, task_id, product_name, category, rate, rate_unit,
      total_applied, total_unit, cost_per_unit, total_cost, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedAll = db.transaction(() => {
    let txCount = 0;
    let timeCount = 0;
    let taskCount = 0;

    for (const field of fields) {
      const ha = field.area_ha || 10;

      // --- 2025 INPUT APPLICATIONS ---

      // Lime application (not every field, ~60% of fields)
      if (lime && Math.random() < 0.6) {
        const qty = Math.round(ha * 2 * 10) / 10; // 2 tonnes/ha
        const cost = qty * lime.cost_per_unit;
        insertTx.run(uuidv4(), lime.id, 'usage', '2025-03-15', qty,
          lime.cost_per_unit, cost, field.id, null, 'Japie Nel',
          `Lime application ${field.code}`, now);
        txCount++;
      }

      // KCl fertilizer (most rooibos fields)
      if (kcl && Math.random() < 0.75) {
        const qty = Math.round(ha * 150); // 150 kg/ha
        const cost = qty * kcl.cost_per_unit;
        insertTx.run(uuidv4(), kcl.id, 'usage', '2025-04-10', qty,
          kcl.cost_per_unit, cost, field.id, null, 'Appie Swarts',
          `KCl application ${field.code}`, now);
        txCount++;
      }

      // Glyphosate (weed control, ~50% of fields)
      if (glyphosate && Math.random() < 0.5) {
        const qty = Math.round(ha * 3 * 10) / 10; // 3 L/ha
        const cost = qty * glyphosate.cost_per_unit;
        insertTx.run(uuidv4(), glyphosate.id, 'usage', '2025-08-20', qty,
          glyphosate.cost_per_unit, cost, field.id, null, 'Appie Swarts',
          `Pre-season weed spray ${field.code}`, now);
        txCount++;
      }

      // Diesel for harvest machinery
      if (diesel) {
        const qty = Math.round(ha * 12); // 12 L/ha for harvest
        const cost = qty * diesel.cost_per_unit;
        insertTx.run(uuidv4(), diesel.id, 'usage', '2025-01-20', qty,
          diesel.cost_per_unit, cost, field.id, null, 'Japie Nel',
          `Harvest diesel ${field.code}`, now);
        txCount++;
      }

      // 2026 applications (current season)
      if (kcl && Math.random() < 0.7) {
        const qty = Math.round(ha * 160); // slightly more this year
        const cost = qty * kcl.cost_per_unit;
        insertTx.run(uuidv4(), kcl.id, 'usage', '2026-03-20', qty,
          kcl.cost_per_unit, cost, field.id, null, 'Appie Swarts',
          `KCl spring application ${field.code}`, now);
        txCount++;
      }

      // --- LABOUR TIME ENTRIES (2025 season) ---

      if (appie) {
        // Harvest labour (Jan-Feb)
        insertTime.run(uuidv4(), appie.id, '2025-01-15', '05:30', '14:30', 9,
          'harvest', 'rooibos', field.id, null,
          `Harvest ${field.code}`, now);
        insertTime.run(uuidv4(), appie.id, '2025-01-16', '05:30', '14:30', 9,
          'harvest', 'rooibos', field.id, null,
          `Harvest ${field.code} day 2`, now);
        timeCount += 2;

        // Weeding (Jun)
        insertTime.run(uuidv4(), appie.id, '2025-06-10', '06:00', '14:00', 8,
          'field_work', 'rooibos', field.id, null,
          `Weeding ${field.code}`, now);
        timeCount++;
      }

      if (japie) {
        // Field inspection
        insertTime.run(uuidv4(), japie.id, '2025-03-05', '07:00', '09:00', 2,
          'inspection', 'rooibos', field.id, null,
          `Post-harvest inspection ${field.code}`, now);
        timeCount++;
      }

      if (adrie) {
        // Equipment work in field
        insertTime.run(uuidv4(), adrie.id, '2025-01-14', '06:00', '12:00', 6,
          'maintenance', 'rooibos', field.id, null,
          `Bovic cutter setup ${field.code}`, now);
        timeCount++;
      }

      // --- TASKS WITH INPUTS LINKED TO FIELDS ---

      // Completed harvest task
      const harvestTaskId = uuidv4();
      insertTask.run(harvestTaskId, `Harvest ${field.name}`, `Cut and collect rooibos from ${field.code}`,
        'rooibos', field.id, 'scheduled', 'completed', 'high',
        '2025-01-20', '2025-01-22', 'Appie Swarts', 'Appie Swarts',
        null, null, null, null, now, now);

      insertTaskInput.run(uuidv4(), harvestTaskId, 'Diesel', 'fuel',
        12, 'L/ha', Math.round(ha * 12), 'L', 24, Math.round(ha * 12 * 24), null);
      taskCount++;

      // Fertilizer application task (2026, pending for some fields)
      if (Math.random() < 0.5) {
        const fertTaskId = uuidv4();
        const status = Math.random() < 0.3 ? 'completed' : 'pending';
        const completedDate = status === 'completed' ? '2026-03-22' : null;
        insertTask.run(fertTaskId, `Fertilize ${field.name}`,
          `Apply KCl and lime to ${field.code}`,
          'rooibos', field.id, 'scheduled', status, 'medium',
          '2026-03-20', completedDate, status === 'completed' ? 'Appie Swarts' : null,
          'Appie Swarts', null, null, null, null, now, now);

        insertTaskInput.run(uuidv4(), fertTaskId, 'Potassium Chloride (KCl)', 'fertilizer',
          150, 'kg/ha', Math.round(ha * 150), 'kg', 12, Math.round(ha * 150 * 12), null);
        insertTaskInput.run(uuidv4(), fertTaskId, 'Agricultural Lime', 'fertilizer',
          2, 'tonnes/ha', Math.round(ha * 2 * 10) / 10, 'tonnes', 850,
          Math.round(ha * 2 * 850), null);
        taskCount++;
      }

      // Weed control task
      if (Math.random() < 0.4) {
        const weedTaskId = uuidv4();
        insertTask.run(weedTaskId, `Weed control ${field.name}`,
          `Spray glyphosate for weed management on ${field.code}`,
          'rooibos', field.id, 'scheduled', 'completed', 'medium',
          '2025-08-15', '2025-08-18', 'Appie Swarts', 'Appie Swarts',
          null, null, null, null, now, now);

        insertTaskInput.run(uuidv4(), weedTaskId, 'Glyphosate', 'herbicide',
          3, 'L/ha', Math.round(ha * 3 * 10) / 10, 'L', 120,
          Math.round(ha * 3 * 120), null);
        taskCount++;
      }
    }

    console.log(`  Fields with cost data: ${fields.length}`);
    console.log(`  Inventory transactions: ${txCount}`);
    console.log(`  Time entries: ${timeCount}`);
    console.log(`  Tasks with inputs: ${taskCount}`);
  });

  seedAll();
  console.log('Field cost seed complete.');
}

/**
 * Backfill stand_pct on field_production records for rooibos fields.
 * Stand % is derived from planted_year:
 *   - Year 1: ~80% (post-planting survival)
 *   - Declines ~6-8% per year with random variation
 *   - By year 5: ~50%
 *   - If still >70% at year 5, field can delay replant
 */
function seedStandPercent(db) {
  try {
    // Check if already backfilled
    const filled = db.prepare(
      "SELECT COUNT(*) as c FROM field_production WHERE stand_pct IS NOT NULL"
    ).get().c;
    if (filled > 0) {
      console.log('Stand % already seeded, skipping.');
      return;
    }
  } catch (e) {
    console.log('stand_pct column not ready, skipping.');
    return;
  }

  console.log('Seeding stand % data for rooibos fields...');

  // Get all rooibos fields with planted_year
  const rooibosFields = db.prepare(`
    SELECT f.id, f.planted_year, f.code, f.area_ha
    FROM fields f
    WHERE f.enterprise = 'rooibos' AND f.planted_year IS NOT NULL
  `).all();

  const updateStand = db.prepare(
    'UPDATE field_production SET stand_pct = ? WHERE field_id = ? AND year = ?'
  );

  const seedAll = db.transaction(() => {
    let updated = 0;

    for (const field of rooibosFields) {
      const plantedYear = parseInt(field.planted_year);
      if (isNaN(plantedYear)) continue;

      // Get all production records for this field
      const productions = db.prepare(
        'SELECT id, year FROM field_production WHERE field_id = ? ORDER BY year'
      ).all(field.id);

      // Each field gets a slightly different decline rate (soil, disease variation)
      // Base: starts 78-82%, drops 5-9% per year
      const startStand = 78 + Math.random() * 4; // 78-82%
      const annualDecline = 5 + Math.random() * 4; // 5-9% per year

      for (const prod of productions) {
        const rotationYear = prod.year - plantedYear;

        if (rotationYear < 0) continue; // before planting
        if (rotationYear === 0) {
          // Planting year — no stand yet (seedlings)
          updateStand.run(null, field.id, prod.year);
          continue;
        }

        // Stand % with some year-to-year noise
        const noise = (Math.random() - 0.5) * 4; // ±2%
        let stand = startStand - (annualDecline * (rotationYear - 1)) + noise;

        // Clamp to realistic range
        stand = Math.max(20, Math.min(95, stand));

        // After typical cycle length, stand would be very low or field replanted
        if (rotationYear > 6) stand = Math.max(20, stand - 10);

        updateStand.run(Math.round(stand * 10) / 10, field.id, prod.year);
        updated++;
      }
    }

    console.log(`  Updated stand % for ${updated} production records across ${rooibosFields.length} fields`);
  });

  seedAll();
  console.log('Stand % seed complete.');
}

module.exports = { seedFieldCosts, seedStandPercent };
