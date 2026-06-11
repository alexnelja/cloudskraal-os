// Spec 3.2 — starter template library. Rates/durations are ESTIMATES seeded as
// a starting point — refine from operator feedback (the spec's stated intent).
// Product names should match the input_products catalogue; estimateCost warns
// (not fails) when a product has no price yet.
const TEMPLATES = [
  // rooibos
  { id: 'tpl-roo-harvest', usage: 'rooibos', op_type: 'harvest', name: 'Teesny (harvest)',
    default_duration_hrs: 9, default_unit_rate: null, sort_order: 0,
    notes: 'Harvest labour ~70% of CoP — capture team + hours on completion' },
  { id: 'tpl-roo-top', usage: 'rooibos', op_type: 'prune', name: 'Top na-oes (prune)',
    default_duration_hrs: 6, sort_order: 1 },
  { id: 'tpl-roo-spray', usage: 'rooibos', op_type: 'spray', name: 'Onkruidspuit',
    default_inputs_json: JSON.stringify([{ product: 'Glifosaat', rate_per_ha: 2, unit: 'l' }]),
    default_duration_hrs: 4, sort_order: 2 },
  { id: 'tpl-roo-firebreak', usage: 'rooibos', op_type: 'firebreak', name: 'Voorbrand sny',
    default_duration_hrs: 5, sort_order: 3, notes: 'Cederberg-mandatory; FPA fee separate' },
  { id: 'tpl-roo-replant', usage: 'rooibos', op_type: 'plant', name: 'Herplant kolle',
    default_inputs_json: JSON.stringify([{ product: 'Rooibos saailinge', rate_per_ha: 500, unit: 'plante' }]),
    default_duration_hrs: 8, sort_order: 4 },
  // lupines / fourrages
  { id: 'tpl-lup-plant', usage: 'lupines_fourrages', op_type: 'plant', name: 'Plant lupiene',
    default_inputs_json: JSON.stringify([{ product: 'Lupien saad', rate_per_ha: 100, unit: 'kg' }]),
    default_duration_hrs: 6, sort_order: 0 },
  { id: 'tpl-lup-spray', usage: 'lupines_fourrages', op_type: 'spray', name: 'Onkruidspuit',
    default_inputs_json: JSON.stringify([{ product: 'Glifosaat', rate_per_ha: 1.5, unit: 'l' }]),
    default_duration_hrs: 4, sort_order: 1 },
  { id: 'tpl-lup-bale', usage: 'lupines_fourrages', op_type: 'harvest', name: 'Sny en baal',
    default_duration_hrs: 8, sort_order: 2 },
  // oats
  { id: 'tpl-oats-plant', usage: 'oats', op_type: 'plant', name: 'Plant hawer',
    default_inputs_json: JSON.stringify([{ product: 'Hawer saad', rate_per_ha: 80, unit: 'kg' }]),
    default_duration_hrs: 6, sort_order: 0 },
  { id: 'tpl-oats-bale', usage: 'oats', op_type: 'harvest', name: 'Sny en baal hawer',
    default_duration_hrs: 8, sort_order: 1 },
  // fallow
  { id: 'tpl-fal-disc', usage: 'fallow', op_type: 'disc', name: 'Skoffel / disc',
    default_duration_hrs: 5, sort_order: 0 },
  { id: 'tpl-fal-lime', usage: 'fallow', op_type: 'fertilize', name: 'Kalk toedien',
    default_inputs_json: JSON.stringify([{ product: 'Landboukalk', rate_per_ha: 1000, unit: 'kg' }]),
    default_duration_hrs: 4, sort_order: 1 },
  // grazing
  { id: 'tpl-grz-move', usage: 'grazing', op_type: 'livestock', name: 'Skuif kudde',
    default_duration_hrs: 2, sort_order: 0 },
  { id: 'tpl-grz-fence', usage: 'grazing', op_type: 'maintenance', name: 'Heining inspeksie',
    default_duration_hrs: 3, sort_order: 1 },
  // wine
  { id: 'tpl-wine-prune', usage: 'wine', op_type: 'prune', name: 'Snoei wingerd',
    default_duration_hrs: 8, sort_order: 0 },
  { id: 'tpl-wine-spray', usage: 'wine', op_type: 'spray', name: 'Swawelspuit',
    default_inputs_json: JSON.stringify([{ product: 'Swawel', rate_per_ha: 5, unit: 'kg' }]),
    default_duration_hrs: 4, sort_order: 1 },
  { id: 'tpl-wine-harvest', usage: 'wine', op_type: 'harvest', name: 'Parsoes',
    default_duration_hrs: 10, sort_order: 2 },
];

function seedTaskTemplates(db) {
  const insert = db.prepare(`INSERT OR IGNORE INTO task_op_templates
    (id,usage,op_type,name,default_inputs_json,default_duration_hrs,default_unit_rate,notes,sort_order)
    VALUES (@id,@usage,@op_type,@name,@default_inputs_json,@default_duration_hrs,@default_unit_rate,@notes,@sort_order)`);
  const tx = db.transaction(() => {
    for (const t of TEMPLATES) {
      insert.run({ default_inputs_json: null, default_duration_hrs: null,
                   default_unit_rate: null, notes: null, ...t });
    }
  });
  tx();
}

module.exports = { seedTaskTemplates };
