const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');

const XLSX_PATH = path.join(__dirname, '..', '..', '..', 'data', 'Cloudskraal_October 2025.xlsx');

function excelDateToISO(input) {
  if (input == null) return null;
  // ExcelJS parses date cells into JS Date objects automatically.
  if (input instanceof Date) {
    return input.toISOString().split('T')[0];
  }
  // Legacy serial number path (kept for safety — older sheets without cell formatting)
  if (typeof input === 'number') {
    const date = new Date((input - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  return null;
}

// Convert an ExcelJS worksheet to an array of row objects keyed by header row (row 1).
// Mimics the xlsx `sheet_to_json(ws, { defval: null })` shape used pre-migration.
function readSheet(wb, name) {
  const ws = wb.getWorksheet(name);
  if (!ws) return [];

  const headerRow = ws.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj = {};
    let hasAny = false;
    for (let c = 1; c < headers.length; c++) {
      const key = headers[c];
      if (key == null || key === '') continue;
      const raw = row.getCell(c).value;
      // ExcelJS represents rich text, formulas, hyperlinks as objects. Normalize to plain values.
      let v = raw;
      if (v && typeof v === 'object') {
        if ('result' in v) v = v.result;             // formula cells
        else if ('text' in v) v = v.text;             // hyperlink cells
        else if ('richText' in v && Array.isArray(v.richText)) {
          v = v.richText.map(rt => rt.text).join(''); // rich text
        }
      }
      if (v === undefined || v === '') v = null;
      obj[key] = v;
      if (v !== null) hasAny = true;
    }
    if (hasAny) rows.push(obj);
  }
  return rows;
}

async function seedExcelImport(db) {
  if (!fs.existsSync(XLSX_PATH)) {
    console.log('Excel file not found, skipping import.');
    return;
  }

  // Check if already imported
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM suppliers').get().c;
    if (count > 0) {
      console.log('Excel data already imported, skipping.');
      return;
    }
  } catch (e) {
    console.log('Supplier table not ready, skipping excel import.');
    return;
  }

  console.log('Importing data from Cloudskraal_October 2025.xlsx...');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const now = new Date().toISOString();

  const seedAll = db.transaction(() => {
    // ═══════════════════════════════════════════════════════════════════════
    // SUPPLIERS (8 rows)
    // ═══════════════════════════════════════════════════════════════════════
    const suppliers = readSheet(wb, 'Suppliers');
    const insertSupplier = db.prepare(`
      INSERT INTO suppliers (id, name, legal_entity, vat_number, bbbee_level,
        registration_no, primary_contact, phone, email, website, physical_address,
        delivery_regions, product_categories, payment_terms, preferred, incoterms,
        min_order, lead_time_days, lead_time_variability, return_policy,
        certifications, notes, reliability_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let supplierCount = 0;
    for (const s of suppliers) {
      const name = s['Supplier Name'];
      if (!name) continue;
      insertSupplier.run(
        uuidv4(), name, s['Legal Entity'] || null,
        s['VAT Number'] ? String(s['VAT Number']) : null,
        s['B-BBEE Level'] ? String(s['B-BBEE Level']) : null,
        s['Registration / CSD No'] || null,
        s['Primary Contact'] || null, s['Phone'] ? String(s['Phone']) : null,
        s['Email'] || null, s['Website'] || null, s['Physical Address'] || null,
        s['Delivery Regions'] || null, s['Product Categories'] || null,
        s['Payment Terms'] || null,
        s['Preferred Supplier'] === true || s['Preferred Supplier'] === 'true' ? 1 : 0,
        s['Incoterms / Delivery'] || null,
        s['Minimum Order Qty / Value'] ? String(s['Minimum Order Qty / Value']) : null,
        s['Lead Time (days)'] || null, s['Lead Time Variability'] || null,
        s['Return Policy Summary'] || null, s['Certifications'] || null,
        s['Notes'] || null, s['Reliability Score'] || null,
        now, now
      );
      supplierCount++;
    }
    console.log(`  Suppliers: ${supplierCount}`);

    // ═══════════════════════════════════════════════════════════════════════
    // CUSTOMERS (10 rows)
    // ═══════════════════════════════════════════════════════════════════════
    const customers = readSheet(wb, 'Customer');
    const insertCustomer = db.prepare(`
      INSERT INTO customers (id, name, business_type, legal_entity, vat_number,
        registration_no, primary_contact, phone, email, website, physical_address,
        delivery_region, preferred_products, contract_type, contract_volume,
        contract_price, payment_terms, payment_status, logistics_terms,
        certifications_required, notes, reliability_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let customerCount = 0;
    for (const c of customers) {
      const name = c['Customer Name'];
      if (!name) continue;
      insertCustomer.run(
        uuidv4(), name, c['Business Type'] || null, c['Legal Entity'] || null,
        c['VAT Number'] ? String(c['VAT Number']) : null,
        c['Registration No / Importer No'] || null,
        c['Primary Contact'] || null, c['Phone'] ? String(c['Phone']) : null,
        c['Email'] || null, c['Website'] || null, c['Physical Address'] || null,
        c['Delivery Region / Market'] || null, c['Preferred Products'] || null,
        c['Contract Type'] || null, c['Contract Volume (annual or per cycle, with units)'] || null,
        c['Contract Price (R/unit)'] || null, c['Payment Terms'] || null,
        c['Payment Status'] || null, c['Logistics / Delivery Terms'] || null,
        c['Certifications Required'] || null, c['Notes'] || null,
        c['Reliability Score'] || null, now, now
      );
      customerCount++;
    }
    console.log(`  Customers: ${customerCount}`);

    // ═══════════════════════════════════════════════════════════════════════
    // FARMS — update existing with extra fields from Excel
    // ═══════════════════════════════════════════════════════════════════════
    const farms = readSheet(wb, 'Farms');
    const farmCodeMap = {
      'Cloudskraal': 'cloudskraal',
      'Garsland': 'garsland',
      'Glenridge Leeus': 'glenridge',
      'Glenridge Kerk': 'glenridge',
      'Biekoes - Vaal': 'biekoes',
      'Biekoes -  Straatklip': 'biekoes',
      'Kromvlei 244': 'kromvlei',
      'Meulsteenvlei': 'meulsteenvlei',
    };

    // Add water_source, power, infrastructure columns if missing
    const farmCols = ['water_source', 'power_source', 'infrastructure', 'soil_notes'];
    for (const col of farmCols) {
      try {
        db.prepare(`SELECT ${col} FROM farms LIMIT 1`).get();
      } catch (e) {
        db.exec(`ALTER TABLE farms ADD COLUMN ${col} TEXT`);
        console.log(`  Migrated: added ${col} to farms`);
      }
    }

    let farmUpdates = 0;
    for (const f of farms) {
      const farmName = f['Farm Name'];
      if (!farmName) continue;
      const code = farmCodeMap[farmName];
      if (!code) continue;

      const existing = db.prepare('SELECT id FROM farms WHERE code = ?').get(code);
      if (!existing) continue;

      db.prepare(`
        UPDATE farms SET water_source = ?, power_source = ?, infrastructure = ?, soil_notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        f['Water Source'] || null,
        f['Power'] || null,
        f['Key Infrastructure'] || null,
        f['Soil/Topo Notes'] || null,
        now, existing.id
      );
      farmUpdates++;
    }
    console.log(`  Farms updated: ${farmUpdates}`);

    // ═══════════════════════════════════════════════════════════════════════
    // SHEEP FLOCK (27 groups)
    // ═══════════════════════════════════════════════════════════════════════
    const sheepData = readSheet(wb, 'Sheep Flock');
    const existingGroups = db.prepare('SELECT COUNT(*) as c FROM livestock_groups').get().c;

    if (existingGroups === 0) {
      const insertGroup = db.prepare(`
        INSERT INTO livestock_groups (id, name, enterprise, species, breed,
          management_type, head_count, current_field_id, average_weight_kg,
          notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertRecord = db.prepare(`
        INSERT INTO livestock_records (id, group_id, record_type, date, details,
          head_count, field_id, product_used, cost, recorded_by, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let sheepCount = 0;
      for (const s of sheepData) {
        const flockName = s['Flock ID / Name'];
        if (!flockName) continue;

        const breed = s['Breed / Strain'] || 'Dohne Merino';
        const headCount = s['Head Count'] || 0;
        const rams = s['Rams'] || 0;
        const ewes = s['Ewes'] || 0;
        const lambs = s['Lambs'] || 0;
        const avgWeight = s['Avg Weight (kg)'] || null;
        const bcs = s['Body Condition Score (avg, 1–5)'] || null;
        const lambingPct = s['Lambing %'] || null;
        const weaningPct = s['Weaning %'] || null;
        const woolWeight = s['Wool / Fleece Weight (kg per head)'] || null;
        const inputCost = s['Input Costs (R/head)'] || null;
        const outputValue = s['Output Value (R/head)'] || null;
        const netMargin = s['Net Margin'] || null;
        const paddock = s['Farm / Paddock Name'] || '';
        const responsible = s['Responsible Person'] || null;

        // Determine management type from context
        let mgmtType = 'breeding';
        if (/ram/i.test(flockName)) mgmtType = 'stud';
        else if (/sale|market/i.test(flockName)) mgmtType = 'trading';
        else if (/replacement|weaner|young/i.test(flockName)) mgmtType = 'replacement';
        else if (/lambing/i.test(flockName)) mgmtType = 'breeding';

        const notes = [
          `Paddock: ${paddock}`,
          rams > 0 ? `Rams: ${rams}` : null,
          ewes > 0 ? `Ewes: ${ewes}` : null,
          lambs > 0 ? `Lambs: ${lambs}` : null,
          bcs ? `BCS: ${bcs}` : null,
          lambingPct ? `Lambing: ${(lambingPct * 100).toFixed(0)}%` : null,
          weaningPct ? `Weaning: ${(weaningPct * 100).toFixed(0)}%` : null,
          woolWeight ? `Wool: ${woolWeight} kg/head` : null,
          inputCost ? `Input cost: R${inputCost}/head` : null,
          outputValue ? `Output: R${outputValue}/head` : null,
          netMargin ? `Margin: R${netMargin}/head` : null,
          s['Notes'] || null,
        ].filter(Boolean).join('. ');

        const groupId = uuidv4();
        insertGroup.run(
          groupId, flockName, 'sheep', 'sheep', breed,
          mgmtType, headCount, null, avgWeight,
          notes, now, now
        );

        // Add health record if treatments given
        const treatments = s['Health Treatments Given'];
        if (treatments && treatments !== 'None') {
          insertRecord.run(
            uuidv4(), groupId, 'health', now.split('T')[0],
            treatments, headCount, null, treatments, null,
            responsible, `Vaccination: ${s['Vaccination Status'] || '?'}, Deworming: ${s['Deworming Status'] || '?'}`,
            now
          );
        }

        // Add mortality record
        const mortality = s['Mortality (last 30 days)'];
        if (mortality && mortality > 0) {
          insertRecord.run(
            uuidv4(), groupId, 'mortality', now.split('T')[0],
            s['Mortality Reason'] || 'Unknown', mortality, null, null, null,
            responsible, null, now
          );
        }

        // Add shearing record if wool data exists
        const shearDate = s['Shearing Date'];
        if (woolWeight && woolWeight > 0 && shearDate) {
          const dateStr = excelDateToISO(shearDate) || now.split('T')[0];
          db.prepare(`
            INSERT INTO shearing_records (id, group_id, date, head_shorn, total_fleece_kg,
              avg_fleece_kg, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(), groupId, dateStr, headCount,
            Math.round(woolWeight * headCount * 10) / 10,
            woolWeight, `Imported from Excel`, now
          );
        }

        sheepCount++;
      }
      console.log(`  Sheep flock groups: ${sheepCount}`);
    } else {
      console.log('  Sheep flock already seeded, skipping.');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EQUIPMENT 2 (10 items — more detailed than Equipment sheet)
    // ═══════════════════════════════════════════════════════════════════════
    const equipData = readSheet(wb, 'Equipment 2');
    const existingEquip = db.prepare('SELECT COUNT(*) as c FROM equipment').get().c;

    if (existingEquip === 0) {
      const insertEquip = db.prepare(`
        INSERT INTO equipment (id, name, code, type, make, model, year, farm_id,
          purchase_date, purchase_price, current_value, depreciation_method,
          useful_life_years, status, hours_meter, odometer_km,
          next_service_date, next_service_hours, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let equipCount = 0;
      for (const e of equipData) {
        const assetId = e['Asset ID'];
        if (!assetId) continue;

        const make = e['Make'] || '';
        const model = e['Model'] || '';
        const name = `${make} ${model}`.trim() || assetId;
        const type = (e['Asset Type'] || 'Other').toLowerCase();

        // Try to match farm
        const farmName = e['Farm Name'] || '';
        let farmId = null;
        const farmMatch = db.prepare("SELECT id FROM farms WHERE name LIKE ?").get(`%${farmName.split(' ')[0]}%`);
        if (farmMatch) farmId = farmMatch.id;

        const purchaseDate = excelDateToISO(e['Acquisition Date']);
        const lastServiceDate = excelDateToISO(e['Last Service Date']);
        const nextServiceDate = excelDateToISO(e['Next Service Date']);

        const meterType = e['Meter Type'] || '';
        const meterReading = e['Current Meter Reading'] || null;
        const hoursM = meterType === 'Hours' ? meterReading : null;
        const odoM = meterType === 'km' ? meterReading : null;

        const notes = [
          e['Serial/VIN'] ? `S/N: ${e['Serial/VIN']}` : null,
          e['Registration/Plate'] ? `Reg: ${e['Registration/Plate']}` : null,
          e['Fuel Type'] ? `Fuel: ${e['Fuel Type']}` : null,
          e['Avg Fuel Use (L/hr or L/100km)'] ? `Consumption: ${e['Avg Fuel Use (L/hr or L/100km)']}` : null,
          e['PTO/Power (kW/HP)'] ? `Power: ${e['PTO/Power (kW/HP)']}` : null,
          e['Owner/Lease'] === 'Lease' ? 'LEASED' : null,
          e['Criticality'] ? `Criticality: ${e['Criticality']}` : null,
          e['Notes'] || null,
        ].filter(Boolean).join('. ');

        insertEquip.run(
          uuidv4(), name, assetId, type, make || null, model || null,
          e['Year'] || null, farmId, purchaseDate,
          e['Purchase Price (R)'] || null, e['Est. Current Value (R)'] || null,
          (e['Depreciation Method'] || 'straight_line').toLowerCase().replace(/ /g, '_'),
          e['Useful Life (years)'] || null,
          (e['Status'] || 'active').toLowerCase().replace(/ /g, '_'),
          hoursM, odoM, nextServiceDate,
          e['Next Service Due (Hours)'] || null,
          notes, now, now
        );

        // Add last service as maintenance log
        if (lastServiceDate) {
          db.prepare(`
            INSERT INTO maintenance_logs (id, equipment_id, type, date, description,
              hours_at_service, notes, created_at)
            VALUES (?, (SELECT id FROM equipment WHERE code = ?), 'scheduled', ?, 'Regular service', ?, 'Imported from Excel', ?)
          `).run(uuidv4(), assetId, lastServiceDate, e['Last Service Meter'] || null, now);
        }

        equipCount++;
      }
      console.log(`  Equipment: ${equipCount}`);
    } else {
      console.log('  Equipment already seeded, skipping.');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // OUTPUTS (10 sales/output transactions)
    // ═══════════════════════════════════════════════════════════════════════
    const outputs = readSheet(wb, 'Outputs');
    const existingSales = db.prepare('SELECT COUNT(*) as c FROM sales').get().c;

    if (existingSales === 0) {
      const insertSale = db.prepare(`
        INSERT INTO sales (id, batch_id, customer, quantity_kg, unit_price,
          total_amount, currency, export_destination, invoice_number,
          status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'ZAR', ?, ?, ?, ?, ?, ?)
      `);

      let outputCount = 0;
      for (const o of outputs) {
        const outId = o['Output ID'];
        if (!outId) continue;

        const dateStr = excelDateToISO(o['Date']) || now.split('T')[0];
        const qty = o['Quantity'] || 0;
        const price = o['Price per Unit (R)'] || 0;
        const total = o['Total Value'] || qty * price;
        const dest = o['Destination / Market'] || null;
        const payStatus = (o['Payment Status'] || 'pending').toLowerCase();

        const status = payStatus === 'paid' ? 'paid' :
                       payStatus === 'overdue' ? 'overdue' : 'pending';

        const notes = [
          o['Output Category'] ? `Category: ${o['Output Category']}` : null,
          o['Product Name'] ? `Product: ${o['Product Name']}` : null,
          o['Variety / Breed'] ? `Variety: ${o['Variety / Breed']}` : null,
          o['Quality Grade'] ? `Grade: ${o['Quality Grade']}` : null,
          o['Certification'] ? `Cert: ${o['Certification']}` : null,
          o['Costs Allocated (R)'] ? `Costs: R${o['Costs Allocated (R)']}` : null,
          o['Net Margin (R)'] ? `Margin: R${o['Net Margin (R)']}` : null,
          o['Notes'] || null,
        ].filter(Boolean).join('. ');

        insertSale.run(
          uuidv4(), null, o['Buyer / Customer'] || 'Unknown',
          qty, price, total, dest === 'Export' ? dest : null,
          o['Invoice / Delivery Note Ref'] || null,
          status, notes, now, now
        );
        outputCount++;
      }
      console.log(`  Output/Sales: ${outputCount}`);
    } else {
      console.log('  Sales already imported, skipping.');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INPUTS (10 input application records)
    // ═══════════════════════════════════════════════════════════════════════
    const inputs = readSheet(wb, 'Inputs');
    // Only import if we have very few inventory transactions (from seed only)
    const existingTxCount = db.prepare('SELECT COUNT(*) as c FROM inventory_transactions').get().c;

    if (existingTxCount < 200) {
      let inputCount = 0;
      for (const inp of inputs) {
        const inputId = inp['Input ID'];
        if (!inputId) continue;

        const dateStr = excelDateToISO(inp['Date Applied']) || now.split('T')[0];
        const category = (inp['Input Category'] || 'other').toLowerCase();
        const productName = inp['Input Name / Product'] || 'Unknown';
        const totalCost = inp['Total Cost'] || 0;
        const qty = inp['Total Quantity Used'] || 0;
        const costPerUnit = inp['Cost per Unit (R)'] || null;

        // Try to find matching product
        const product = db.prepare(
          'SELECT id FROM input_products WHERE name LIKE ? LIMIT 1'
        ).get(`%${productName.split(' ')[0]}%`);

        if (product) {
          db.prepare(`
            INSERT INTO inventory_transactions (id, product_id, type, date, quantity,
              unit_cost, total_cost, field_id, task_id, recorded_by, notes, created_at)
            VALUES (?, ?, 'usage', ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(), product.id, dateStr, qty, costPerUnit, totalCost,
            null, null, inp['Responsible Person'] || null,
            `${inp['Purpose'] || ''} (${inp['Application Method'] || ''})`.trim(),
            now
          );
          inputCount++;
        }
      }
      console.log(`  Input transactions: ${inputCount}`);
    } else {
      console.log('  Input transactions already populated, skipping.');
    }
  });

  seedAll();
  console.log('Excel import complete.');
}

module.exports = { seedExcelImport };
