const { v4: uuidv4 } = require('uuid');

function seedPhase3(db) {
  // Skip if already seeded
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM employees').get().c;
    if (count > 0) {
      console.log('Phase 3 already seeded, skipping.');
      return;
    }
  } catch (e) {
    console.log('Phase 3 tables not ready, skipping seed.');
    return;
  }

  console.log('Seeding Phase 3: employees, inventory, financials...');
  const now = new Date().toISOString();

  // Look up farm IDs
  const garsland = db.prepare("SELECT id FROM farms WHERE code = ?").get('garsland');
  const cloudskraal = db.prepare("SELECT id FROM farms WHERE code = ?").get('cloudskraal');
  const garslandId = garsland ? garsland.id : null;
  const cloudskraalId = cloudskraal ? cloudskraal.id : null;

  const seedAll = db.transaction(() => {
    // ── EMPLOYEES ──────────────────────────────────────────────────────────────

    const insertEmployee = db.prepare(`
      INSERT INTO employees (id, name, id_number, type, department, role, farm_id,
        hourly_rate, monthly_salary, start_date, end_date, status, phone,
        emergency_contact, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const japieId = uuidv4();
    insertEmployee.run(japieId, 'Japie Nel', null, 'permanent', 'Management',
      'Farm Manager', cloudskraalId, null, 45000, null, null, 'active',
      null, null, null, now, now);

    const francesId = uuidv4();
    insertEmployee.run(francesId, 'Frances Nel', null, 'permanent', 'Administration & HR',
      'Admin Manager', cloudskraalId, null, 35000, null, null, 'active',
      null, null, null, now, now);

    const adrieId = uuidv4();
    insertEmployee.run(adrieId, 'Adrie Basson', null, 'permanent', 'Mechanical Maintenance',
      'Foreman (Maintenance)', garslandId, null, 22000, null, null, 'active',
      null, null, null, now, now);

    const appieId = uuidv4();
    insertEmployee.run(appieId, 'Appie Swarts', null, 'permanent', 'Livestock',
      'Foreman (Sheep & Crops)', cloudskraalId, null, 22000, null, null, 'active',
      null, null, null, now, now);

    // ── TIME ENTRIES (last week) ──────────────────────────────────────────────

    const insertTime = db.prepare(`
      INSERT INTO time_entries (id, employee_id, date, clock_in, clock_out,
        hours_worked, activity_type, enterprise, field_id, task_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const today = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    // Helper: date string N days ago
    const daysAgo = (n) => new Date(today.getTime() - n * dayMs).toISOString().split('T')[0];

    // Japie — management tasks
    insertTime.run(uuidv4(), japieId, daysAgo(1), '07:00', '17:00', 10, 'admin', null, null, null, 'Farm planning and supplier meetings', now);
    insertTime.run(uuidv4(), japieId, daysAgo(2), '06:30', '16:30', 10, 'field_work', 'rooibos', null, null, 'Field inspections', now);
    insertTime.run(uuidv4(), japieId, daysAgo(3), '07:00', '15:00', 8, 'admin', null, null, null, 'Financial review', now);

    // Frances — admin tasks
    insertTime.run(uuidv4(), francesId, daysAgo(1), '08:00', '16:00', 8, 'admin', null, null, null, 'Payroll processing', now);
    insertTime.run(uuidv4(), francesId, daysAgo(2), '08:00', '16:00', 8, 'admin', null, null, null, 'Supplier invoices', now);

    // Adrie — maintenance tasks
    insertTime.run(uuidv4(), adrieId, daysAgo(1), '06:00', '15:00', 9, 'maintenance', null, null, null, 'Bovic cutter servicing', now);
    insertTime.run(uuidv4(), adrieId, daysAgo(2), '06:00', '14:00', 8, 'maintenance', null, null, null, 'Tractor hydraulic repair', now);
    insertTime.run(uuidv4(), adrieId, daysAgo(4), '06:00', '16:00', 10, 'maintenance', null, null, null, 'Workshop inventory and tool check', now);

    // Appie — livestock tasks
    insertTime.run(uuidv4(), appieId, daysAgo(1), '05:30', '14:30', 9, 'livestock', 'sheep', null, null, 'Flock inspection and dosing', now);
    insertTime.run(uuidv4(), appieId, daysAgo(2), '05:30', '15:00', 9.5, 'field_work', 'rooibos', null, null, 'Rooibos field weeding', now);
    insertTime.run(uuidv4(), appieId, daysAgo(3), '06:00', '14:00', 8, 'livestock', 'sheep', null, null, 'Camp rotation', now);

    // ── INPUT PRODUCTS ────────────────────────────────────────────────────────

    const insertProduct = db.prepare(`
      INSERT INTO input_products (id, name, category, unit_of_measure, active_ingredients,
        withholding_period_days, re_entry_interval_hours, supplier, cost_per_unit,
        storage_requirements, notes, wiki_page_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Try to link wiki pages by slug
    const getWikiId = (slug) => {
      const row = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?').get(slug);
      return row ? row.id : null;
    };

    const limeId = uuidv4();
    insertProduct.run(limeId, 'Agricultural Lime', 'fertilizer', 'tonnes', null,
      0, null, null, 850, 'Dry storage', null, getWikiId('agricultural-lime'), now, now);

    const kclId = uuidv4();
    insertProduct.run(kclId, 'Potassium Chloride (KCl)', 'fertilizer', 'kg', 'Potassium Chloride',
      null, null, null, 12, 'Dry storage', null, getWikiId('potassium-chloride'), now, now);

    const glyphosateId = uuidv4();
    insertProduct.run(glyphosateId, 'Glyphosate', 'herbicide', 'L', 'Glyphosate',
      14, 12, null, 120, 'Chemical store — locked', null, getWikiId('glyphosate'), now, now);

    const ivermectinId = uuidv4();
    insertProduct.run(ivermectinId, 'Ivermectin', 'pesticide', 'mL', 'Ivermectin',
      35, null, null, 2.50, 'Cool storage', 'Livestock use', getWikiId('ivermectin'), now, now);

    const dieselId = uuidv4();
    insertProduct.run(dieselId, 'Diesel', 'fuel', 'L', null,
      null, null, null, 24, null, null, null, now, now);

    const seedId = uuidv4();
    insertProduct.run(seedId, 'Rooibos Seed', 'seed', 'kg', null,
      null, null, null, 800, 'Cool, dry storage', null, getWikiId('rooibos-seed'), now, now);

    // ── INVENTORY STOCK ───────────────────────────────────────────────────────

    const insertStock = db.prepare(`
      INSERT INTO inventory_stock (id, product_id, location, quantity_on_hand,
        batch_number, expiry_date, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertStock.run(uuidv4(), dieselId, 'Cloudskraal store', 5000, null, null, now);
    insertStock.run(uuidv4(), glyphosateId, 'Garsland chemical store', 200, null, null, now);
    insertStock.run(uuidv4(), ivermectinId, 'Cloudskraal vet store', 5000, null, null, now); // 5000 mL = 5L
    insertStock.run(uuidv4(), seedId, 'Garsland nursery', 50, null, null, now);

    // ── ENTERPRISES ───────────────────────────────────────────────────────────

    const insertEnterprise = db.prepare(`
      INSERT INTO enterprises (id, name, type, entity, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const rooibosEntId = uuidv4();
    insertEnterprise.run(rooibosEntId, 'Rooibos', 'crop', 'Cloudskraal Boerdery BK', null);

    const wineEntId = uuidv4();
    insertEnterprise.run(wineEntId, 'Wine/Grapes', 'crop', 'Cloudskraal Boerdery BK', null);

    const sheepEntId = uuidv4();
    insertEnterprise.run(sheepEntId, 'Sheep/Wool', 'livestock', 'Cloudskraal Boerdery BK', null);

    const processingEntId = uuidv4();
    insertEnterprise.run(processingEntId, 'Processing/Export', 'processing', 'Alexenya Produksie BK', null);

    const tourismEntId = uuidv4();
    insertEnterprise.run(tourismEntId, 'Tourism', 'tourism', 'Cloudskraal Boerdery BK', null);

    // ── FINANCIAL TRANSACTIONS ────────────────────────────────────────────────

    const insertFinTx = db.prepare(`
      INSERT INTO financial_transactions (id, date, description, type, amount,
        category, enterprise_id, field_id, source_reference, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Revenue
    insertFinTx.run(uuidv4(), '2025-12-31', 'Rooibos sales FY2025', 'revenue', 6100000,
      'Sales', rooibosEntId, null, 'Audited financials', null, now);
    insertFinTx.run(uuidv4(), '2025-12-31', 'Wine & grape sales FY2025', 'revenue', 2000000,
      'Sales', wineEntId, null, 'Audited financials', null, now);
    insertFinTx.run(uuidv4(), '2025-12-31', 'Sheep & wool sales FY2025', 'revenue', 1600000,
      'Sales', sheepEntId, null, 'Audited financials', null, now);
    insertFinTx.run(uuidv4(), '2025-12-31', 'Interest income FY2025', 'revenue', 2040000,
      'Interest', null, null, 'Audited financials', 'Group-level interest income', now);

    // Expenses
    insertFinTx.run(uuidv4(), '2025-12-31', 'Employee costs FY2025', 'expense', 1200000,
      'Employee costs', null, null, 'Audited financials', null, now);
    insertFinTx.run(uuidv4(), '2025-12-31', 'Fertilizer & chemicals FY2025', 'expense', 450000,
      'Fertilizer & chemicals', rooibosEntId, null, 'Audited financials', null, now);
    insertFinTx.run(uuidv4(), '2025-12-31', 'Fuel & transport FY2025', 'expense', 380000,
      'Fuel & transport', null, null, 'Audited financials', null, now);
    insertFinTx.run(uuidv4(), '2025-12-31', 'Repairs & maintenance FY2025', 'expense', 320000,
      'Repairs & maintenance', null, null, 'Audited financials', null, now);
    insertFinTx.run(uuidv4(), '2025-12-31', 'Depreciation FY2025', 'expense', 290000,
      'Depreciation', null, null, 'Audited financials', null, now);

    // ── BUDGETS 2026 ──────────────────────────────────────────────────────────

    const insertBudget = db.prepare(`
      INSERT INTO budgets (id, enterprise_id, year, category,
        jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Rooibos revenue — heavier Jan-Apr (harvest season)
    insertBudget.run(uuidv4(), rooibosEntId, 2026, 'Revenue',
      900000, 800000, 700000, 600000, 400000, 350000,
      350000, 400000, 400000, 400000, 400000, 400000);

    // Rooibos expenses
    insertBudget.run(uuidv4(), rooibosEntId, 2026, 'Employee costs',
      100000, 100000, 100000, 100000, 100000, 100000,
      100000, 100000, 100000, 100000, 100000, 100000);

    // Sheep/Wool revenue — heavier Sep-Nov (shearing/sales)
    insertBudget.run(uuidv4(), sheepEntId, 2026, 'Revenue',
      80000, 80000, 80000, 80000, 80000, 80000,
      100000, 150000, 250000, 250000, 200000, 100000);

    // Wine/Grapes revenue — heavier Feb-Apr (harvest)
    insertBudget.run(uuidv4(), wineEntId, 2026, 'Revenue',
      100000, 350000, 400000, 350000, 150000, 100000,
      100000, 100000, 100000, 100000, 100000, 100000);

    console.log('  Employees: 4');
    console.log('  Time entries: 11');
    console.log('  Input products: 6');
    console.log('  Inventory stock: 4');
    console.log('  Enterprises: 5');
    console.log('  Financial transactions: 9');
    console.log('  Budgets: 4');
  });

  seedAll();
  console.log('Phase 3 seed complete.');
}

module.exports = { seedPhase3 };
