const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');

const router = Router();

// GET /api/inventory/alerts — low stock or expiring soon
router.get('/inventory/alerts', (req, res) => {
  const db = getDb();
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const expiring = db.prepare(`
    SELECT s.*, p.name AS product_name, p.category, p.unit_of_measure
    FROM inventory_stock s
    JOIN input_products p ON p.id = s.product_id
    WHERE s.expiry_date IS NOT NULL AND s.expiry_date <= ?
    ORDER BY s.expiry_date
  `).all(thirtyDaysFromNow);

  // Low stock: quantity_on_hand <= 10% of a reasonable threshold (simple heuristic)
  const lowStock = db.prepare(`
    SELECT s.*, p.name AS product_name, p.category, p.unit_of_measure
    FROM inventory_stock s
    JOIN input_products p ON p.id = s.product_id
    WHERE s.quantity_on_hand <= 0
    ORDER BY p.name
  `).all();

  res.json({ expiring, lowStock });
});

// GET /api/inventory/summary — aggregate stats
router.get('/inventory/summary', (req, res) => {
  const db = getDb();

  const totalProducts = db.prepare('SELECT COUNT(*) as count FROM input_products').get().count;

  const totalValue = db.prepare(`
    SELECT COALESCE(SUM(s.quantity_on_hand * p.cost_per_unit), 0) as value
    FROM inventory_stock s
    JOIN input_products p ON p.id = s.product_id
  `).get().value;

  const lowStockCount = db.prepare(`
    SELECT COUNT(*) as count FROM inventory_stock WHERE quantity_on_hand <= 0
  `).get().count;

  const byCategoryRows = db.prepare(`
    SELECT p.category, COUNT(DISTINCT p.id) as products,
      COALESCE(SUM(s.quantity_on_hand * p.cost_per_unit), 0) as value
    FROM input_products p
    LEFT JOIN inventory_stock s ON s.product_id = p.id
    GROUP BY p.category
  `).all();
  const byCategory = {};
  for (const row of byCategoryRows) {
    byCategory[row.category] = { products: row.products, value: row.value };
  }

  res.json({ totalProducts, totalValue, lowStockCount, byCategory });
});

// GET /api/inventory/products — list all (?category)
router.get('/inventory/products', (req, res) => {
  const db = getDb();
  let sql = 'SELECT * FROM input_products WHERE 1=1';
  const params = [];

  if (req.query.category) {
    sql += ' AND category = ?';
    params.push(req.query.category);
  }

  sql += ' ORDER BY name';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/inventory/products/:id — product with stock levels
router.get('/inventory/products/:id', (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT * FROM input_products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const stock = db.prepare('SELECT * FROM inventory_stock WHERE product_id = ?').all(req.params.id);
  res.json({ ...product, stock });
});

// POST /api/inventory/products — create
router.post('/inventory/products', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO input_products (id, name, category, unit_of_measure, active_ingredients,
      withholding_period_days, re_entry_interval_hours, supplier, cost_per_unit,
      storage_requirements, notes, wiki_page_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.name, b.category, b.unit_of_measure || null, b.active_ingredients || null,
    b.withholding_period_days || null, b.re_entry_interval_hours || null,
    b.supplier || null, b.cost_per_unit || null, b.storage_requirements || null,
    b.notes || null, b.wiki_page_id || null, now, now);

  const product = db.prepare('SELECT * FROM input_products WHERE id = ?').get(id);
  res.status(201).json(product);
});

// PATCH /api/inventory/products/:id — update
router.patch('/inventory/products/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM input_products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const allowed = ['name', 'category', 'unit_of_measure', 'active_ingredients',
    'withholding_period_days', 're_entry_interval_hours', 'supplier', 'cost_per_unit',
    'storage_requirements', 'notes', 'wiki_page_id'];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE input_products SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  const product = db.prepare('SELECT * FROM input_products WHERE id = ?').get(req.params.id);
  res.json(product);
});

// GET /api/inventory/stock — current stock levels joined with product names
router.get('/inventory/stock', (req, res) => {
  const db = getDb();
  const stock = db.prepare(`
    SELECT s.*, p.name AS product_name, p.category, p.unit_of_measure, p.cost_per_unit
    FROM inventory_stock s
    JOIN input_products p ON p.id = s.product_id
    ORDER BY p.name
  `).all();

  res.json(stock);
});

// POST /api/inventory/transactions — record transaction
router.post('/inventory/transactions', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  // INSERT + stock UPDATE are atomic: a failed stock update rolls back the INSERT.
  db.transaction(() => {
    db.prepare(`
      INSERT INTO inventory_transactions (id, product_id, type, date, quantity,
        unit_cost, total_cost, field_id, task_id, recorded_by, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, b.product_id, b.type, b.date, b.quantity,
      b.unit_cost || null, b.total_cost || null, b.field_id || null,
      b.task_id || null, b.recorded_by || null, b.notes || null, now);

    // Update stock levels
    const stock = db.prepare(
      'SELECT * FROM inventory_stock WHERE product_id = ? LIMIT 1'
    ).get(b.product_id);

    if (stock) {
      const delta = (b.type === 'purchase' || b.type === 'adjustment') ? b.quantity :
                    (b.type === 'usage' || b.type === 'disposal') ? -b.quantity : 0;
      db.prepare(
        'UPDATE inventory_stock SET quantity_on_hand = quantity_on_hand + ?, last_updated = ? WHERE id = ?'
      ).run(delta, now, stock.id);
    }
  })();

  const tx = db.prepare('SELECT * FROM inventory_transactions WHERE id = ?').get(id);
  res.status(201).json(tx);
});

// GET /api/inventory/transactions — transaction history (?product_id, ?type, ?date_from)
router.get('/inventory/transactions', (req, res) => {
  const db = getDb();
  let sql = `
    SELECT t.*, p.name AS product_name, p.unit_of_measure
    FROM inventory_transactions t
    JOIN input_products p ON p.id = t.product_id
    WHERE 1=1
  `;
  const params = [];

  if (req.query.product_id) {
    sql += ' AND t.product_id = ?';
    params.push(req.query.product_id);
  }
  if (req.query.field_id) {
    sql += ' AND t.field_id = ?';
    params.push(req.query.field_id);
  }
  if (req.query.type) {
    sql += ' AND t.type = ?';
    params.push(req.query.type);
  }
  if (req.query.date_from) {
    sql += ' AND t.date >= ?';
    params.push(req.query.date_from);
  }

  sql += ' ORDER BY t.date DESC';
  res.json(db.prepare(sql).all(...params));
});

module.exports = router;
