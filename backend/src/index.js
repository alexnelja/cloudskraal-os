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

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize DB and seed
const db = getDb();
seedDatabase(db);
seedFarms(db);
seedCalendar(db);
seedWiki(db);
seedPhase2(db);
seedPhase3(db);
seedExcelImport(db);
seedLandUse2026(db);
seedUsagePeriods(db);
seedFieldCosts(db);
seedStandPercent(db);
seedConversionFactors(db);

app.listen(PORT, () => {
  console.log(`Cloudskraal CapEx API running on http://localhost:${PORT}`);
});
