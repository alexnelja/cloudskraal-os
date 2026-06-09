// Spec 2i.2 — derive a machine/attachment operating cost per hour from
// depreciation + maintenance + fuel. cost_per_ha is activity-derived (2i.3:
// cost_per_hour × hours ÷ ha), so it is NOT computed here.
function round2(n) { return Math.round(n * 100) / 100; }

const DIESEL_DEFAULT_ZAR_PER_L = 22; // SA diesel ~2026; override via farm_config

function dieselPrice(db) {
  try {
    const r = db.prepare("SELECT value FROM farm_config WHERE key = 'diesel_price_zar_per_l'").get();
    const v = r ? parseFloat(r.value) : NaN;
    return Number.isFinite(v) ? v : DIESEL_DEFAULT_ZAR_PER_L;
  } catch { return DIESEL_DEFAULT_ZAR_PER_L; }
}

function equipmentRate(db, equipmentId, opts = {}) {
  const e = db.prepare('SELECT * FROM equipment WHERE id = ?').get(equipmentId);
  if (!e) return { error: 'equipment_not_found', cost_per_hour: null };

  const method = e.depreciation_method || 'straight_line';
  if (method !== 'straight_line') {
    return { error: 'depreciation_method_unsupported', method, cost_per_hour: null };
  }
  if (!e.annual_use_hours || e.annual_use_hours <= 0) {
    return { warning: 'annual_use_hours_missing', cost_per_hour: null };
  }

  const depPerYear = ((e.purchase_price || 0) - (e.salvage_value || 0)) / (e.useful_life_years || Infinity);
  const depreciation_per_hour = round2(depPerYear / e.annual_use_hours);
  const maintenance_per_hour = round2((e.maintenance_zar_per_year || 0) / e.annual_use_hours);
  // Attachments have no engine → no fuel.
  const fuel_per_hour = e.kind === 'attachment'
    ? 0
    : round2((e.fuel_l_per_hour || 0) * (opts.dieselPrice ?? dieselPrice(db)));

  return {
    equipment_id: equipmentId,
    kind: e.kind || 'machine',
    depreciation_per_hour,
    maintenance_per_hour,
    fuel_per_hour,
    cost_per_hour: round2(depreciation_per_hour + maintenance_per_hour + fuel_per_hour),
  };
}

// Machine + optional attachment combined per-hour cost (one diesel-price lookup).
function comboRate(db, machineId, attachmentId) {
  const price = dieselPrice(db);
  const machine = equipmentRate(db, machineId, { dieselPrice: price });
  if (!attachmentId) return machine;
  const attach = equipmentRate(db, attachmentId, { dieselPrice: price });
  const sum = (a, b) => (a == null || b == null) ? null : round2(a + b);
  return {
    machine,
    attachment: attach,
    cost_per_hour: sum(machine.cost_per_hour, attach.cost_per_hour),
  };
}

module.exports = { equipmentRate, comboRate };
