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
const { migrateMapLayersLive } = require('./migrate-map-layers-live');
const { migrateMapLayersExtra } = require('./migrate-map-layers-extra');
const { migrateMapLayersCleanupBasemaps } = require('./migrate-map-layers-cleanup-basemaps');
const { migrateWikiPageLinks } = require('./migrate-wiki-page-links');
const { migrateMeasurements } = require('./migrate-measurements');
const { migrateReclassifyLargeFields } = require('./migrate-reclassify-large-fields');
const { initTaskManagerSchema, seedDefaultTags, seedDefaultStatuses } = require('./schema-tasks');
const { migrateTaskStatusId } = require('./migrate-task-status-id');
const { migrateAddIndexes } = require('./migrate-add-indexes');
const { migrateFieldsFarmCascade } = require('./migrate-fields-farm-cascade');
const { migrateFkCascades } = require('./migrate-fk-cascades');
const { migrateEnterprisePriceBasis } = require('./migrate-enterprise-price-basis');
const { initFlockCopInputsSchema } = require('./schema-flock-cop-inputs');
const { initGrazingEventsSchema } = require('./schema-grazing-events');
const { initFeedingEventsSchema } = require('./schema-feeding-events');
const { migrateBreedingWeaningWeight } = require('./migrate-breeding-weaning-weight');
const { migrateStockingDensity } = require('./migrate-stocking-density');
const { initFarmConfigSchema } = require('./schema-farm-config');
const { migrateTransferMarket } = require('./migrate-transfer-market');
const { initProcessingSchema } = require('./schema-processing');
const { initLongHorizonSchema } = require('./schema-long-horizon');
const { migrateProcessingRecirculation } = require('./migrate-processing-recirculation');
const { migrateProcessingFractions } = require('./migrate-processing-fractions');
const { initSharedInputsSchema } = require('./schema-shared-inputs');
const { migrateEquipmentRates } = require('./migrate-equipment-rates');
const { initActivitiesSchema } = require('./schema-activities');
const { initTaskTemplatesSchema } = require('./schema-task-templates');
const { seedTaskTemplates } = require('./seed-task-templates');
const { initTaskEventsSchema } = require('./schema-task-events');

const DB_PATH = process.env.CAPEX_DB_PATH ?? path.join(__dirname, '..', '..', 'data', 'capex.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -32000'); // 32 MB

    ensureMigrationsTable(db);

    initSchema(db);
    runMigration(db, 'init-farm-schema', initFarmSchema);
    runMigration(db, 'init-calendar-schema', initCalendarSchema);
    runMigration(db, 'init-wiki-schema', initWikiSchema);
    runMigration(db, 'init-phase2-schema', initPhase2Schema);
    runMigration(db, 'init-phase3-schema', initPhase3Schema);
    runMigration(db, 'init-usage-periods-schema', initUsagePeriodsSchema);
    runMigration(db, 'migrate-field-cop', migrateFieldCop);
    runMigration(db, 'init-conversion-factors-schema', initConversionFactorsSchema);
    runMigration(db, 'init-enterprise-prices-schema', initEnterprisePricesSchema);
    runMigration(db, 'init-annotations-schema', initAnnotationsSchema);
    runMigration(db, 'migrate-annotations-category', migrateAnnotationsCategory);
    runMigration(db, 'migrate-tasks-annotation-link', migrateTasksAnnotationLink);
    runMigration(db, 'migrate-map-layers-live', migrateMapLayersLive);
    runMigration(db, 'migrate-map-layers-extra', migrateMapLayersExtra);
    runMigration(db, 'migrate-map-layers-cleanup-basemaps', migrateMapLayersCleanupBasemaps);
    runMigration(db, 'migrate-wiki-page-links', migrateWikiPageLinks);
    runMigration(db, 'migrate-measurements', migrateMeasurements);
    runMigration(db, 'migrate-reclassify-large-fields', migrateReclassifyLargeFields);
    runMigration(db, 'init-task-manager-schema', initTaskManagerSchema);
    runMigration(db, 'seed-default-tags', seedDefaultTags);
    runMigration(db, 'seed-default-statuses', seedDefaultStatuses);
    runMigration(db, 'migrate-task-status-id', migrateTaskStatusId);
    runMigration(db, 'add-indexes', migrateAddIndexes);
    runMigration(db, 'migrate-fields-farm-cascade', migrateFieldsFarmCascade);
    runMigration(db, 'migrate-fk-cascades', migrateFkCascades);
    runMigration(db, 'migrate-enterprise-price-basis', migrateEnterprisePriceBasis);
    runMigration(db, 'init-flock-cop-inputs-schema', initFlockCopInputsSchema);
    runMigration(db, 'init-grazing-events-schema', initGrazingEventsSchema);
    runMigration(db, 'init-feeding-events-schema', initFeedingEventsSchema);
    runMigration(db, 'migrate-breeding-weaning-weight', migrateBreedingWeaningWeight);
    runMigration(db, 'migrate-stocking-density', migrateStockingDensity);
    runMigration(db, 'init-farm-config-schema', initFarmConfigSchema);
    runMigration(db, 'migrate-transfer-market', migrateTransferMarket);
    runMigration(db, 'init-processing-schema', initProcessingSchema);
    runMigration(db, 'init-long-horizon-schema', initLongHorizonSchema);
    runMigration(db, 'migrate-processing-recirculation', migrateProcessingRecirculation);
    runMigration(db, 'migrate-processing-fractions', migrateProcessingFractions);
    runMigration(db, 'init-shared-inputs-schema', initSharedInputsSchema);
    runMigration(db, 'migrate-equipment-rates', migrateEquipmentRates);
    runMigration(db, 'init-activities-schema', initActivitiesSchema);
    runMigration(db, 'init-task-templates-schema', initTaskTemplatesSchema);
    runMigration(db, 'seed-task-templates', seedTaskTemplates);
    runMigration(db, 'init-task-events-schema', initTaskEventsSchema);
  }
  return db;
}

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
}

function runMigration(db, name, fn) {
  const exists = db.prepare('SELECT name FROM schema_migrations WHERE name = ?').get(name);
  if (exists) return;
  fn(db);
  db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(name, new Date().toISOString());
  console.log(`[migration] ${name} applied`);
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

/** Only call this in tests — closes and forgets the current db instance. */
function _resetForTest() {
  if (db) {
    try { db.close(); } catch (_) { /* ignore */ }
    db = undefined;
  }
}

module.exports = { getDb, _resetForTest };
