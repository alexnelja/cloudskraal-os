// Spec 6 — shared calculator helpers.
function round2(n) { return Math.round(n * 100) / 100; }

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

// Catalogue price lookup: exact name first, then case-insensitive contains
// (label names rarely match the catalogue exactly — spec's fuzzy-match note).
function productPrice(db, name, warnings) {
  if (!db || !name) return null;
  try {
    let p = db.prepare('SELECT cost_per_unit FROM input_products WHERE name = ?').get(name);
    if (!p) {
      p = db.prepare(
        "SELECT cost_per_unit FROM input_products WHERE LOWER(name) LIKE '%' || LOWER(?) || '%' LIMIT 1"
      ).get(name);
    }
    if (p && p.cost_per_unit != null) return p.cost_per_unit;
  } catch { /* catalogue absent */ }
  warnings.push(`product_price_missing: ${name}`);
  return null;
}

module.exports = { round2, num, productPrice };
