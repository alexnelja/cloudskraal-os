const path = require('path');
const Database = require('better-sqlite3');
const { initFarmSchema } = require('./schema-farms');
const { initCalendarSchema } = require('./schema-calendar');
const { initWikiSchema } = require('./schema-wiki');
const { initPhase2Schema } = require('./schema-phase2');
const { initPhase3Schema } = require('./schema-phase3');
const { initUsagePeriodsSchema } = require('./schema-usage-periods');
const { migrateFieldCop } = require('./migrate-field-cop');
const { initConversionFactorsSchema } = require('./schema-conversion-factors');
const { initEnterprisePricesSchema } = require('./schema-enterprise-prices');
const { initAnnotationsSchema } = require('./schema-annotations');
const { migrateAnnotationsCategory } = require('./migrate-annotations-category');
const { migrateTasksAnnotationLink } = require('./migrate-tasks-annotation-link');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'capex.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    initFarmSchema(db);
    initCalendarSchema(db);
    initWikiSchema(db);
    initPhase2Schema(db);
    initPhase3Schema(db);
    initUsagePeriodsSchema(db);
    migrateFieldCop(db);
    initConversionFactorsSchema(db);
    initEnterprisePricesSchema(db);
    initAnnotationsSchema(db);
    migrateAnnotationsCategory(db);
    migrateTasksAnnotationLink(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      initialOutlay REAL NOT NULL DEFAULT 0,
      usefulLifeYears INTEGER NOT NULL DEFAULT 10,
      salvageValue REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      priority TEXT NOT NULL DEFAULT 'tier3',
      taxBenefit TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_flows (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      year INTEGER NOT NULL,
      revenue REAL NOT NULL DEFAULT 0,
      operatingCosts REAL NOT NULL DEFAULT 0,
      netCashFlow REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      name TEXT NOT NULL,
      debtPercent REAL NOT NULL DEFAULT 0.6,
      equityPercent REAL NOT NULL DEFAULT 0.4,
      interestRate REAL NOT NULL DEFAULT 0.105,
      loanTermYears INTEGER NOT NULL DEFAULT 10,
      equityCostPercent REAL NOT NULL DEFAULT 0.15,
      repaymentType TEXT NOT NULL DEFAULT 'equal_installments',
      wacc REAL,
      npv REAL,
      irr REAL,
      paybackYears REAL,
      profitabilityIndex REAL,
      monthlyPayment REAL,
      totalInterest REAL,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
}

module.exports = { getDb };
