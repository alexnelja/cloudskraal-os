function initPhase2Schema(db) {
  db.exec(`
    -- EQUIPMENT
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      type TEXT NOT NULL,
      make TEXT,
      model TEXT,
      year INTEGER,
      farm_id TEXT REFERENCES farms(id),
      department TEXT,
      purchase_date TEXT,
      purchase_price REAL,
      current_value REAL,
      depreciation_method TEXT DEFAULT 'straight_line',
      useful_life_years INTEGER,
      salvage_value REAL,
      status TEXT DEFAULT 'active',
      hours_meter REAL,
      odometer_km REAL,
      next_service_date TEXT,
      next_service_hours REAL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maintenance_logs (
      id TEXT PRIMARY KEY,
      equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      cost REAL,
      performed_by TEXT,
      hours_at_service REAL,
      parts_used TEXT,
      next_due_date TEXT,
      next_due_hours REAL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    -- LIVESTOCK
    CREATE TABLE IF NOT EXISTS livestock_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enterprise TEXT DEFAULT 'sheep',
      species TEXT NOT NULL,
      breed TEXT,
      management_type TEXT,
      head_count INTEGER NOT NULL DEFAULT 0,
      current_field_id TEXT REFERENCES fields(id),
      average_weight_kg REAL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS livestock_records (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES livestock_groups(id) ON DELETE CASCADE,
      record_type TEXT NOT NULL,
      date TEXT NOT NULL,
      details TEXT,
      head_count INTEGER,
      field_id TEXT REFERENCES fields(id),
      product_used TEXT,
      cost REAL,
      recorded_by TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS breeding_seasons (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES livestock_groups(id),
      year INTEGER NOT NULL,
      joining_start TEXT,
      joining_end TEXT,
      rams_used INTEGER,
      ewes_joined INTEGER,
      scanning_date TEXT,
      pregnant_count INTEGER,
      dry_count INTEGER,
      singles_count INTEGER,
      twins_count INTEGER,
      triplets_count INTEGER,
      lambing_start TEXT,
      lambing_end TEXT,
      born_count INTEGER,
      survived_count INTEGER,
      weaned_count INTEGER,
      weaning_date TEXT,
      weaning_percentage REAL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shearing_records (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES livestock_groups(id),
      date TEXT NOT NULL,
      head_shorn INTEGER,
      total_fleece_kg REAL,
      avg_fleece_kg REAL,
      micron_avg REAL,
      yield_pct REAL,
      vegetable_matter REAL,
      staple_length_mm REAL,
      grade TEXT,
      buyer TEXT,
      price_per_kg REAL,
      total_revenue REAL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    -- PRODUCTION
    CREATE TABLE IF NOT EXISTS production_batches (
      id TEXT PRIMARY KEY,
      batch_code TEXT UNIQUE NOT NULL,
      enterprise TEXT NOT NULL,
      product_type TEXT,
      source_field_ids TEXT,
      harvest_date_start TEXT,
      harvest_date_end TEXT,
      initial_quantity_kg REAL,
      current_quantity_kg REAL,
      status TEXT DEFAULT 'received',
      quality_grade TEXT,
      storage_location TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS processing_steps (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      step_type TEXT NOT NULL,
      start_datetime TEXT,
      end_datetime TEXT,
      facility TEXT,
      equipment_id TEXT REFERENCES equipment(id),
      operator TEXT,
      input_quantity_kg REAL,
      output_quantity_kg REAL,
      loss_kg REAL,
      loss_reason TEXT,
      parameters TEXT,
      quality_check_passed INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quality_tests (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
      test_type TEXT,
      test_date TEXT NOT NULL,
      tested_by TEXT,
      results TEXT,
      pass_fail TEXT,
      certificate_number TEXT,
      lab_reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      batch_id TEXT REFERENCES production_batches(id),
      customer TEXT NOT NULL,
      quantity_kg REAL,
      unit_price REAL,
      total_amount REAL,
      currency TEXT DEFAULT 'ZAR',
      export_destination TEXT,
      invoice_number TEXT,
      shipped_date TEXT,
      paid_date TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

module.exports = { initPhase2Schema };
