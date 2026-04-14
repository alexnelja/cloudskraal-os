const express = require('express');
const { getDb } = require('../db/schema');

const router = express.Router();

router.get('/enterprise-prices', (req, res) => {
  const db = getDb();
  const enterprise = req.query.enterprise;
  const sql = enterprise
    ? `SELECT id, enterprise, year, price_per_kg, notes, created_at, updated_at
         FROM enterprise_prices WHERE enterprise = ? ORDER BY year ASC`
    : `SELECT id, enterprise, year, price_per_kg, notes, created_at, updated_at
         FROM enterprise_prices ORDER BY enterprise, year ASC`;
  const rows = enterprise
    ? db.prepare(sql).all(enterprise)
    : db.prepare(sql).all();
  res.json(rows);
});

module.exports = router;
