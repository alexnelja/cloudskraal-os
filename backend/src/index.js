const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { getDb } = require('./db/schema');
const { seedDatabase } = require('./db/seed');
const { seedFarms } = require('./db/seed-farms');
const { seedCalendar } = require('./db/seed-calendar');
const { seedWiki } = require('./db/seed-wiki');
const { seedPhase2 } = require('./db/seed-phase2');
const { seedPhase3 } = require('./db/seed-phase3');
const { seedFieldCosts, seedStandPercent } = require('./db/seed-field-costs');
const { seedExcelImport } = require('./db/seed-excel-import');
const { seedLandUse2026 } = require('./db/seed-land-use-2026');
const { seedUsagePeriods } = require('./db/seed-usage-periods');
const { seedConversionFactors } = require('./db/seed-conversion-factors');
const dashboardRoutes = require('./routes/dashboard');
const projectRoutes = require('./routes/projects');
const farmRoutes = require('./routes/farms');
const calendarRoutes = require('./routes/calendar');
const wikiRoutes = require('./routes/wiki');
const equipmentRoutes = require('./routes/equipment');
const livestockRoutes = require('./routes/livestock');
const productionRoutes = require('./routes/production');
const employeeRoutes = require('./routes/employees');
const inventoryRoutes = require('./routes/inventory');
const financialRoutes = require('./routes/financials');
const supplyChainRoutes = require('./routes/supply-chain');
const usageRoutes = require('./routes/usage');
const conversionFactorsRoutes = require('./routes/conversion-factors');
const enterprisePricesRoutes = require('./routes/enterprise-prices');
const { seedEnterprisePrices } = require('./db/seed-enterprise-prices');
const annotationsRoutes = require('./routes/annotations');
const measurementsRoutes = require('./routes/measurements');
const taskManagerRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Input validation for write methods
const { validateBody } = require('./middleware/validate');
app.use((req, res, next) => {
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    return validateBody()(req, res, next);
  }
  next();
});

// Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', farmRoutes);
app.use('/api', calendarRoutes);
app.use('/api', wikiRoutes);
app.use('/api', equipmentRoutes);
app.use('/api', livestockRoutes);
app.use('/api', productionRoutes);
app.use('/api', employeeRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', financialRoutes);
app.use('/api', supplyChainRoutes);
app.use('/api', usageRoutes);
app.use('/api', conversionFactorsRoutes);
app.use('/api', enterprisePricesRoutes);
app.use('/api', annotationsRoutes);
app.use('/api/measurements', measurementsRoutes);
app.use('/api', taskManagerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Centralized error handler
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// Initialize DB and seed. `seedFarms` and `seedExcelImport` are async because
// ExcelJS `readFile` is promise-based (xlsx→exceljs migration, S-H2).
const db = getDb();

async function initializeAndSeed() {
  seedDatabase(db);
  await seedFarms(db);
  seedCalendar(db);
  seedWiki(db);
  seedPhase2(db);
  seedPhase3(db);
  await seedExcelImport(db);
  seedLandUse2026(db);
  seedUsagePeriods(db);
  seedFieldCosts(db);
  seedStandPercent(db);
  seedConversionFactors(db);
  seedEnterprisePrices(db);
}

// Expose the initialization promise so tests / embedders can await readiness.
const ready = initializeAndSeed().catch((err) => {
  console.error('Seed initialization failed:', err);
  process.exitCode = 1;
  throw err;
});

if (require.main === module) {
  ready.then(() => {
    app.listen(PORT, () => {
      console.log(`Cloudskraal CapEx API running on http://localhost:${PORT}`);
    });
  });
}

module.exports = { app, ready };
