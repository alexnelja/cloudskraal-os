const express = require('express');
const cors = require('cors');
const { getDb } = require('./db/schema');
const { seedDatabase } = require('./db/seed');
const { seedFarms } = require('./db/seed-farms');
const dashboardRoutes = require('./routes/dashboard');
const projectRoutes = require('./routes/projects');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects', projectRoutes);

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

app.listen(PORT, () => {
  console.log(`Cloudskraal CapEx API running on http://localhost:${PORT}`);
});
