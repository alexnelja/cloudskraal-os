const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');

const router = Router();

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────

router.get('/suppliers', (req, res) => {
  const db = getDb();
  const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name').all();
  res.json(suppliers);
});

router.get('/suppliers/:id', (req, res) => {
  const db = getDb();
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  res.json(supplier);
});

router.post('/suppliers', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO suppliers (id, name, legal_entity, vat_number, bbbee_level,
      registration_no, primary_contact, phone, email, website, physical_address,
      delivery_regions, product_categories, payment_terms, preferred, incoterms,
      min_order, lead_time_days, lead_time_variability, return_policy,
      certifications, notes, reliability_score, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, b.name, b.legal_entity || null, b.vat_number || null,
    b.bbbee_level || null, b.registration_no || null,
    b.primary_contact || null, b.phone || null, b.email || null,
    b.website || null, b.physical_address || null,
    b.delivery_regions || null, b.product_categories || null,
    b.payment_terms || null, b.preferred ? 1 : 0, b.incoterms || null,
    b.min_order || null, b.lead_time_days || null,
    b.lead_time_variability || null, b.return_policy || null,
    b.certifications || null, b.notes || null, b.reliability_score || null,
    now, now
  );

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  res.status(201).json(supplier);
});

router.patch('/suppliers/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Supplier not found' });

  const allowed = ['name', 'legal_entity', 'vat_number', 'bbbee_level', 'registration_no',
    'primary_contact', 'phone', 'email', 'website', 'physical_address',
    'delivery_regions', 'product_categories', 'payment_terms', 'preferred',
    'incoterms', 'min_order', 'lead_time_days', 'lead_time_variability',
    'return_policy', 'certifications', 'notes', 'reliability_score'];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE suppliers SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  res.json(supplier);
});

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────

router.get('/customers', (req, res) => {
  const db = getDb();
  const customers = db.prepare('SELECT * FROM customers ORDER BY name').all();
  res.json(customers);
});

router.get('/customers/:id', (req, res) => {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

router.post('/customers', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO customers (id, name, business_type, legal_entity, vat_number,
      registration_no, primary_contact, phone, email, website, physical_address,
      delivery_region, preferred_products, contract_type, contract_volume,
      contract_price, payment_terms, payment_status, logistics_terms,
      certifications_required, notes, reliability_score, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, b.name, b.business_type || null, b.legal_entity || null,
    b.vat_number || null, b.registration_no || null,
    b.primary_contact || null, b.phone || null, b.email || null,
    b.website || null, b.physical_address || null,
    b.delivery_region || null, b.preferred_products || null,
    b.contract_type || null, b.contract_volume || null,
    b.contract_price || null, b.payment_terms || null,
    b.payment_status || null, b.logistics_terms || null,
    b.certifications_required || null, b.notes || null,
    b.reliability_score || null, now, now
  );

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  res.status(201).json(customer);
});

router.patch('/customers/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });

  const allowed = ['name', 'business_type', 'legal_entity', 'vat_number', 'registration_no',
    'primary_contact', 'phone', 'email', 'website', 'physical_address',
    'delivery_region', 'preferred_products', 'contract_type', 'contract_volume',
    'contract_price', 'payment_terms', 'payment_status', 'logistics_terms',
    'certifications_required', 'notes', 'reliability_score'];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE customers SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  res.json(customer);
});

module.exports = router;
