/**
 * Add ON DELETE CASCADE / SET NULL to 7 foreign keys flagged by the DB audit.
 *
 * SQLite cannot ALTER ... ADD CONSTRAINT, so each table is rebuilt in place
 * using the documented 12-step dance. Every rebuild:
 *   - runs inside a `db.transaction` with `PRAGMA foreign_keys = OFF` toggled
 *     at the process boundary (the pragma is a no-op inside a transaction);
 *   - copies existing rows column-for-column into the new table;
 *   - verifies `PRAGMA foreign_key_check` before committing;
 *   - re-creates any indexes that previously existed.
 *
 * The 7 FKs and their chosen actions (each motivated by the audit):
 *
 *   livestock_groups.current_field_id   ON DELETE SET NULL
 *     — field deletion shouldn't remove a group; clear "current position".
 *   breeding_seasons.group_id           ON DELETE CASCADE
 *     — seasons belong to a group; orphaned seasons are meaningless.
 *   shearing_records.group_id           ON DELETE CASCADE
 *     — same rationale.
 *   inventory_transactions.product_id   ON DELETE CASCADE
 *     — transactions make no sense without their product row.
 *   financial_transactions.enterprise_id ON DELETE SET NULL
 *     — tx history is accounting-of-record; don't lose it when an
 *       enterprise is retired. Let the enterprise_id go null.
 *   budgets.enterprise_id               ON DELETE CASCADE
 *     — budgets are strictly per-enterprise.
 *   time_entries.task_id                ON DELETE SET NULL
 *     — payroll can't vanish if a task is deleted.
 *
 * Each rebuild is idempotent: running this after it has already rebuilt a
 * table is a no-op because `foreign_key_list(...)` already reports the
 * correct on_delete action.
 */

function getOnDelete(db, tableName, fromCol) {
  const fks = db.pragma(`foreign_key_list('${tableName}')`);
  const match = fks.find((f) => f.from === fromCol);
  return match ? match.on_delete : null;
}

function rebuildTable(db, { name, createSql, columns, indexes }) {
  const migrate = db.transaction(() => {
    db.exec(`CREATE TABLE ${name}_new ${createSql}`);
    db.exec(`INSERT INTO ${name}_new (${columns.join(', ')}) SELECT ${columns.join(', ')} FROM ${name}`);
    db.exec(`DROP TABLE ${name}`);
    db.exec(`ALTER TABLE ${name}_new RENAME TO ${name}`);
    for (const ix of indexes) db.exec(ix);
    const violations = db.pragma('foreign_key_check');
    if (violations.length > 0) {
      throw new Error(`foreign_key_check failed after ${name} rebuild: ${JSON.stringify(violations)}`);
    }
  });
  migrate();
}

function migrateFkCascades(db) {
  const fkBefore = db.pragma('foreign_keys', { simple: true });

  // Skip if the schema has not yet been initialised (fresh boot still in
  // schema.init). The phase2/phase3 CREATEs run before us in index.js, but
  // tests and seed scripts call us in isolation — be defensive.
  const tableExists = (name) =>
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);

  db.pragma('foreign_keys = OFF');
  try {
    // ------------------------------------------------------------------
    // 1. livestock_groups.current_field_id → SET NULL
    // ------------------------------------------------------------------
    if (tableExists('livestock_groups') && getOnDelete(db, 'livestock_groups', 'current_field_id') !== 'SET NULL') {
      rebuildTable(db, {
        name: 'livestock_groups',
        createSql: `(
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          enterprise TEXT DEFAULT 'sheep',
          species TEXT NOT NULL,
          breed TEXT,
          management_type TEXT,
          head_count INTEGER NOT NULL DEFAULT 0,
          current_field_id TEXT REFERENCES fields(id) ON DELETE SET NULL,
          average_weight_kg REAL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        columns: [
          'id', 'name', 'enterprise', 'species', 'breed', 'management_type',
          'head_count', 'current_field_id', 'average_weight_kg', 'notes',
          'created_at', 'updated_at',
        ],
        indexes: [],
      });
    }

    // ------------------------------------------------------------------
    // 2. breeding_seasons.group_id → CASCADE
    // ------------------------------------------------------------------
    if (tableExists('breeding_seasons') && getOnDelete(db, 'breeding_seasons', 'group_id') !== 'CASCADE') {
      rebuildTable(db, {
        name: 'breeding_seasons',
        createSql: `(
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL REFERENCES livestock_groups(id) ON DELETE CASCADE,
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
        )`,
        columns: [
          'id', 'group_id', 'year', 'joining_start', 'joining_end',
          'rams_used', 'ewes_joined', 'scanning_date', 'pregnant_count',
          'dry_count', 'singles_count', 'twins_count', 'triplets_count',
          'lambing_start', 'lambing_end', 'born_count', 'survived_count',
          'weaned_count', 'weaning_date', 'weaning_percentage', 'notes',
          'created_at', 'updated_at',
        ],
        indexes: [],
      });
    }

    // ------------------------------------------------------------------
    // 3. shearing_records.group_id → CASCADE
    // ------------------------------------------------------------------
    if (tableExists('shearing_records') && getOnDelete(db, 'shearing_records', 'group_id') !== 'CASCADE') {
      rebuildTable(db, {
        name: 'shearing_records',
        createSql: `(
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL REFERENCES livestock_groups(id) ON DELETE CASCADE,
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
        )`,
        columns: [
          'id', 'group_id', 'date', 'head_shorn', 'total_fleece_kg',
          'avg_fleece_kg', 'micron_avg', 'yield_pct', 'vegetable_matter',
          'staple_length_mm', 'grade', 'buyer', 'price_per_kg',
          'total_revenue', 'notes', 'created_at',
        ],
        indexes: [],
      });
    }

    // ------------------------------------------------------------------
    // 4. inventory_transactions.product_id → CASCADE
    // Note: cost_category is added by migrate-field-cop (runs before us);
    // it must be preserved across the rebuild.
    // ------------------------------------------------------------------
    if (tableExists('inventory_transactions') && getOnDelete(db, 'inventory_transactions', 'product_id') !== 'CASCADE') {
      rebuildTable(db, {
        name: 'inventory_transactions',
        createSql: `(
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES input_products(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          date TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit_cost REAL,
          total_cost REAL,
          field_id TEXT REFERENCES fields(id),
          task_id TEXT REFERENCES tasks(id),
          recorded_by TEXT,
          notes TEXT,
          cost_category TEXT NOT NULL DEFAULT 'direct_variable',
          created_at TEXT NOT NULL
        )`,
        columns: [
          'id', 'product_id', 'type', 'date', 'quantity', 'unit_cost',
          'total_cost', 'field_id', 'task_id', 'recorded_by', 'notes',
          'cost_category', 'created_at',
        ],
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_inv_tx_product_date ON inventory_transactions(product_id, date DESC)',
          'CREATE INDEX IF NOT EXISTS idx_inv_tx_field ON inventory_transactions(field_id)',
        ],
      });
    }

    // ------------------------------------------------------------------
    // 5. financial_transactions.enterprise_id → SET NULL
    // ------------------------------------------------------------------
    if (tableExists('financial_transactions') && getOnDelete(db, 'financial_transactions', 'enterprise_id') !== 'SET NULL') {
      rebuildTable(db, {
        name: 'financial_transactions',
        createSql: `(
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          category TEXT,
          enterprise_id TEXT REFERENCES enterprises(id) ON DELETE SET NULL,
          field_id TEXT REFERENCES fields(id),
          source_reference TEXT,
          notes TEXT,
          created_at TEXT NOT NULL
        )`,
        columns: [
          'id', 'date', 'description', 'type', 'amount', 'category',
          'enterprise_id', 'field_id', 'source_reference', 'notes',
          'created_at',
        ],
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_fin_tx_date ON financial_transactions(date DESC)',
          'CREATE INDEX IF NOT EXISTS idx_fin_tx_enterprise ON financial_transactions(enterprise_id, date DESC)',
        ],
      });
    }

    // ------------------------------------------------------------------
    // 6. budgets.enterprise_id → CASCADE
    // ------------------------------------------------------------------
    if (tableExists('budgets') && getOnDelete(db, 'budgets', 'enterprise_id') !== 'CASCADE') {
      rebuildTable(db, {
        name: 'budgets',
        createSql: `(
          id TEXT PRIMARY KEY,
          enterprise_id TEXT NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
          year INTEGER NOT NULL,
          category TEXT NOT NULL,
          jan REAL DEFAULT 0, feb REAL DEFAULT 0, mar REAL DEFAULT 0,
          apr REAL DEFAULT 0, may REAL DEFAULT 0, jun REAL DEFAULT 0,
          jul REAL DEFAULT 0, aug REAL DEFAULT 0, sep REAL DEFAULT 0,
          oct REAL DEFAULT 0, nov REAL DEFAULT 0, dec REAL DEFAULT 0,
          UNIQUE(enterprise_id, year, category)
        )`,
        columns: [
          'id', 'enterprise_id', 'year', 'category',
          'jan', 'feb', 'mar', 'apr', 'may', 'jun',
          'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
        ],
        indexes: [],
      });
    }

    // ------------------------------------------------------------------
    // 7. time_entries.task_id → SET NULL
    // Note: cost_category added by migrate-field-cop, preserved across rebuild.
    // ------------------------------------------------------------------
    if (tableExists('time_entries') && getOnDelete(db, 'time_entries', 'task_id') !== 'SET NULL') {
      rebuildTable(db, {
        name: 'time_entries',
        createSql: `(
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          clock_in TEXT,
          clock_out TEXT,
          hours_worked REAL,
          activity_type TEXT,
          enterprise TEXT,
          field_id TEXT REFERENCES fields(id),
          task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
          notes TEXT,
          cost_category TEXT NOT NULL DEFAULT 'direct_variable',
          created_at TEXT NOT NULL
        )`,
        columns: [
          'id', 'employee_id', 'date', 'clock_in', 'clock_out',
          'hours_worked', 'activity_type', 'enterprise', 'field_id',
          'task_id', 'notes', 'cost_category', 'created_at',
        ],
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_time_entries_emp_date ON time_entries(employee_id, date DESC)',
          'CREATE INDEX IF NOT EXISTS idx_time_entries_field ON time_entries(field_id)',
        ],
      });
    }
  } finally {
    db.pragma(`foreign_keys = ${fkBefore ? 'ON' : 'OFF'}`);
  }
}

module.exports = { migrateFkCascades };
