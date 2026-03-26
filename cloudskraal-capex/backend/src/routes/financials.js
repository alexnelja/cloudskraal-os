const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');

const router = Router();

// GET /api/financials/enterprises — list all
router.get('/financials/enterprises', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM enterprises ORDER BY name').all());
});

// GET /api/financials/dashboard — summary
router.get('/financials/dashboard', (req, res) => {
  const db = getDb();

  const totalRevenue = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM financial_transactions WHERE type = 'revenue'"
  ).get().total;

  const totalExpenses = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM financial_transactions WHERE type = 'expense'"
  ).get().total;

  const netIncome = totalRevenue - totalExpenses;

  const byEnterprise = db.prepare(`
    SELECT e.id, e.name,
      COALESCE(SUM(CASE WHEN ft.type = 'revenue' THEN ft.amount ELSE 0 END), 0) as revenue,
      COALESCE(SUM(CASE WHEN ft.type = 'expense' THEN ft.amount ELSE 0 END), 0) as expenses
    FROM enterprises e
    LEFT JOIN financial_transactions ft ON ft.enterprise_id = e.id
    GROUP BY e.id, e.name
    ORDER BY e.name
  `).all().map(row => ({
    ...row,
    net: row.revenue - row.expenses
  }));

  // Add unallocated (no enterprise)
  const unallocatedRevenue = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM financial_transactions WHERE type = 'revenue' AND enterprise_id IS NULL"
  ).get().total;
  const unallocatedExpenses = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM financial_transactions WHERE type = 'expense' AND enterprise_id IS NULL"
  ).get().total;

  if (unallocatedRevenue > 0 || unallocatedExpenses > 0) {
    byEnterprise.push({
      id: null,
      name: 'Group / Unallocated',
      revenue: unallocatedRevenue,
      expenses: unallocatedExpenses,
      net: unallocatedRevenue - unallocatedExpenses
    });
  }

  res.json({ totalRevenue, totalExpenses, netIncome, byEnterprise });
});

// GET /api/financials/transactions — list (?enterprise_id, ?type, ?date_from, ?date_to, ?category)
router.get('/financials/transactions', (req, res) => {
  const db = getDb();
  let sql = `
    SELECT ft.*, e.name AS enterprise_name
    FROM financial_transactions ft
    LEFT JOIN enterprises e ON e.id = ft.enterprise_id
    WHERE 1=1
  `;
  const params = [];

  if (req.query.enterprise_id) {
    sql += ' AND ft.enterprise_id = ?';
    params.push(req.query.enterprise_id);
  }
  if (req.query.type) {
    sql += ' AND ft.type = ?';
    params.push(req.query.type);
  }
  if (req.query.date_from) {
    sql += ' AND ft.date >= ?';
    params.push(req.query.date_from);
  }
  if (req.query.date_to) {
    sql += ' AND ft.date <= ?';
    params.push(req.query.date_to);
  }
  if (req.query.category) {
    sql += ' AND ft.category = ?';
    params.push(req.query.category);
  }

  sql += ' ORDER BY ft.date DESC';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/financials/transactions — create
router.post('/financials/transactions', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO financial_transactions (id, date, description, type, amount,
      category, enterprise_id, field_id, source_reference, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.date, b.description || null, b.type, b.amount,
    b.category || null, b.enterprise_id || null, b.field_id || null,
    b.source_reference || null, b.notes || null, now);

  const tx = db.prepare(`
    SELECT ft.*, e.name AS enterprise_name
    FROM financial_transactions ft
    LEFT JOIN enterprises e ON e.id = ft.enterprise_id
    WHERE ft.id = ?
  `).get(id);
  res.status(201).json(tx);
});

// GET /api/financials/pnl?year=2025 — P&L statement
router.get('/financials/pnl', (req, res) => {
  const db = getDb();
  const year = req.query.year || new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const revenueRows = db.prepare(`
    SELECT category, COALESCE(SUM(amount), 0) as total
    FROM financial_transactions
    WHERE type = 'revenue' AND date >= ? AND date <= ?
    GROUP BY category ORDER BY total DESC
  `).all(yearStart, yearEnd);

  const expenseRows = db.prepare(`
    SELECT category, COALESCE(SUM(amount), 0) as total
    FROM financial_transactions
    WHERE type = 'expense' AND date >= ? AND date <= ?
    GROUP BY category ORDER BY total DESC
  `).all(yearStart, yearEnd);

  const revenue = {};
  let totalRevenue = 0;
  for (const row of revenueRows) {
    revenue[row.category || 'Other'] = row.total;
    totalRevenue += row.total;
  }

  const expenses = {};
  let totalExpenses = 0;
  for (const row of expenseRows) {
    expenses[row.category || 'Other'] = row.total;
    totalExpenses += row.total;
  }

  res.json({
    year: Number(year),
    revenue,
    totalRevenue,
    expenses,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses
  });
});

// GET /api/budgets — list (?enterprise_id, ?year)
router.get('/budgets', (req, res) => {
  const db = getDb();
  let sql = `
    SELECT b.*, e.name AS enterprise_name
    FROM budgets b
    JOIN enterprises e ON e.id = b.enterprise_id
    WHERE 1=1
  `;
  const params = [];

  if (req.query.enterprise_id) {
    sql += ' AND b.enterprise_id = ?';
    params.push(req.query.enterprise_id);
  }
  if (req.query.year) {
    sql += ' AND b.year = ?';
    params.push(Number(req.query.year));
  }

  sql += ' ORDER BY e.name, b.category';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/budgets — create or update
router.post('/budgets', (req, res) => {
  const db = getDb();
  const b = req.body;

  // Check if exists
  const existing = db.prepare(
    'SELECT id FROM budgets WHERE enterprise_id = ? AND year = ? AND category = ?'
  ).get(b.enterprise_id, b.year, b.category);

  if (existing) {
    db.prepare(`
      UPDATE budgets SET jan=?, feb=?, mar=?, apr=?, may=?, jun=?,
        jul=?, aug=?, sep=?, oct=?, nov=?, dec=?
      WHERE id = ?
    `).run(b.jan || 0, b.feb || 0, b.mar || 0, b.apr || 0, b.may || 0, b.jun || 0,
      b.jul || 0, b.aug || 0, b.sep || 0, b.oct || 0, b.nov || 0, b.dec || 0,
      existing.id);

    const budget = db.prepare(`
      SELECT b.*, e.name AS enterprise_name FROM budgets b
      JOIN enterprises e ON e.id = b.enterprise_id WHERE b.id = ?
    `).get(existing.id);
    return res.json(budget);
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO budgets (id, enterprise_id, year, category,
      jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.enterprise_id, b.year, b.category,
    b.jan || 0, b.feb || 0, b.mar || 0, b.apr || 0, b.may || 0, b.jun || 0,
    b.jul || 0, b.aug || 0, b.sep || 0, b.oct || 0, b.nov || 0, b.dec || 0);

  const budget = db.prepare(`
    SELECT b.*, e.name AS enterprise_name FROM budgets b
    JOIN enterprises e ON e.id = b.enterprise_id WHERE b.id = ?
  `).get(id);
  res.status(201).json(budget);
});

// GET /api/financials/budget-vs-actual?enterprise_id=X&year=2026
router.get('/financials/budget-vs-actual', (req, res) => {
  const db = getDb();
  const { enterprise_id, year } = req.query;

  if (!enterprise_id || !year) {
    return res.status(400).json({ error: 'enterprise_id and year are required' });
  }

  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                   'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthNumbers = ['01', '02', '03', '04', '05', '06',
                        '07', '08', '09', '10', '11', '12'];

  // Get budgets for this enterprise and year
  const budgetRows = db.prepare(
    'SELECT * FROM budgets WHERE enterprise_id = ? AND year = ?'
  ).all(enterprise_id, Number(year));

  // Get actual transactions by month
  const result = months.map((m, i) => {
    const monthStart = `${year}-${monthNumbers[i]}-01`;
    const monthEnd = `${year}-${monthNumbers[i]}-31`;

    const actualRevenue = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM financial_transactions
      WHERE enterprise_id = ? AND type = 'revenue' AND date >= ? AND date <= ?
    `).get(enterprise_id, monthStart, monthEnd).total;

    const actualExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM financial_transactions
      WHERE enterprise_id = ? AND type = 'expense' AND date >= ? AND date <= ?
    `).get(enterprise_id, monthStart, monthEnd).total;

    let budgetRevenue = 0;
    let budgetExpenses = 0;
    for (const br of budgetRows) {
      if (br.category === 'Revenue') {
        budgetRevenue += br[m] || 0;
      } else {
        budgetExpenses += br[m] || 0;
      }
    }

    return {
      month: m,
      budget: { revenue: budgetRevenue, expenses: budgetExpenses, net: budgetRevenue - budgetExpenses },
      actual: { revenue: actualRevenue, expenses: actualExpenses, net: actualRevenue - actualExpenses },
      variance: {
        revenue: actualRevenue - budgetRevenue,
        expenses: actualExpenses - budgetExpenses,
        net: (actualRevenue - actualExpenses) - (budgetRevenue - budgetExpenses)
      }
    };
  });

  res.json(result);
});

module.exports = router;
