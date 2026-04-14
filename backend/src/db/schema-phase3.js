function initPhase3Schema(db) {
  db.exec(`
    -- EMPLOYEES
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      id_number TEXT,
      type TEXT NOT NULL,
      department TEXT,
      role TEXT,
      farm_id TEXT REFERENCES farms(id),
      hourly_rate REAL,
      monthly_salary REAL,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'active',
      phone TEXT,
      emergency_contact TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      clock_in TEXT,
      clock_out TEXT,
      hours_worked REAL,
      activity_type TEXT,
      enterprise TEXT,
      field_id TEXT REFERENCES fields(id),
      task_id TEXT REFERENCES tasks(id),
      notes TEXT,
      created_at TEXT NOT NULL
    );

    -- INPUTS & INVENTORY
    CREATE TABLE IF NOT EXISTS input_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit_of_measure TEXT,
      active_ingredients TEXT,
      withholding_period_days INTEGER,
      re_entry_interval_hours INTEGER,
      supplier TEXT,
      cost_per_unit REAL,
      storage_requirements TEXT,
      notes TEXT,
      wiki_page_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_stock (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES input_products(id) ON DELETE CASCADE,
      location TEXT,
      quantity_on_hand REAL,
      batch_number TEXT,
      expiry_date TEXT,
      last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES input_products(id),
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL,
      total_cost REAL,
      field_id TEXT REFERENCES fields(id),
      task_id TEXT REFERENCES tasks(id),
      recorded_by TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    -- FINANCIALS
    CREATE TABLE IF NOT EXISTS enterprises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      entity TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS financial_transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      enterprise_id TEXT REFERENCES enterprises(id),
      field_id TEXT REFERENCES fields(id),
      source_reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    -- SUPPLIERS
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      legal_entity TEXT,
      vat_number TEXT,
      bbbee_level TEXT,
      registration_no TEXT,
      primary_contact TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      physical_address TEXT,
      delivery_regions TEXT,
      product_categories TEXT,
      payment_terms TEXT,
      preferred INTEGER DEFAULT 0,
      incoterms TEXT,
      min_order TEXT,
      lead_time_days INTEGER,
      lead_time_variability TEXT,
      return_policy TEXT,
      certifications TEXT,
      notes TEXT,
      reliability_score INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- CUSTOMERS
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      business_type TEXT,
      legal_entity TEXT,
      vat_number TEXT,
      registration_no TEXT,
      primary_contact TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      physical_address TEXT,
      delivery_region TEXT,
      preferred_products TEXT,
      contract_type TEXT,
      contract_volume TEXT,
      contract_price REAL,
      payment_terms TEXT,
      payment_status TEXT,
      logistics_terms TEXT,
      certifications_required TEXT,
      notes TEXT,
      reliability_score INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
      year INTEGER NOT NULL,
      category TEXT NOT NULL,
      jan REAL DEFAULT 0, feb REAL DEFAULT 0, mar REAL DEFAULT 0,
      apr REAL DEFAULT 0, may REAL DEFAULT 0, jun REAL DEFAULT 0,
      jul REAL DEFAULT 0, aug REAL DEFAULT 0, sep REAL DEFAULT 0,
      oct REAL DEFAULT 0, nov REAL DEFAULT 0, dec REAL DEFAULT 0,
      UNIQUE(enterprise_id, year, category)
    );
  `);
}

module.exports = { initPhase3Schema };
