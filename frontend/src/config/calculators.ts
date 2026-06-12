// Spec 6b — schema-driven calculator definitions. One config per calc keeps
// the page generic: fields render from this, results format from this.

export interface CalcField {
  key: string;
  label: string;
  unit?: string;
  type?: 'number' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}

export interface CalcResultRow {
  key: string;
  label: string;
  unit?: string;
  currency?: boolean;
}

export interface CalcDef {
  type: string;
  label: string;
  description: string;
  fields: CalcField[];
  results: CalcResultRow[];
}

export const CALCULATORS: CalcDef[] = [
  {
    type: 'sprayer',
    label: 'Sprayer calibration',
    description: 'Application rate from nozzle output, speed and spacing — plus tank fills for a block.',
    fields: [
      { key: 'nozzle_l_min', label: 'Nozzle output', unit: 'L/min', required: true },
      { key: 'speed_kmh', label: 'Travel speed', unit: 'km/h', required: true },
      { key: 'nozzle_spacing_m', label: 'Nozzle spacing', unit: 'm', required: true },
      { key: 'area_ha', label: 'Block area', unit: 'ha' },
      { key: 'tank_size_l', label: 'Tank size', unit: 'L' },
    ],
    results: [
      { key: 'application_l_ha', label: 'Application rate', unit: 'L/ha' },
      { key: 'total_spray_l', label: 'Total spray volume', unit: 'L' },
      { key: 'tank_fills', label: 'Tank fills' },
    ],
  },
  {
    type: 'pest',
    label: 'Pest dose',
    description: 'Total chemical and cost for a block at label rate.',
    fields: [
      { key: 'rate_value', label: 'Label rate', required: true },
      {
        key: 'rate_basis', label: 'Rate basis', type: 'select', required: true,
        options: [
          { value: 'g_per_ha', label: 'g per ha' },
          { value: 'ml_per_ha', label: 'ml per ha' },
          { value: 'g_per_100l', label: 'g per 100 L water' },
          { value: 'ml_per_100l', label: 'ml per 100 L water' },
        ],
      },
      { key: 'area_ha', label: 'Block area', unit: 'ha', required: true },
      { key: 'spray_volume_l_ha', label: 'Spray volume (per-100L basis)', unit: 'L/ha' },
      { key: 'product', label: 'Product (catalogue name for cost)', type: 'select' },
    ],
    results: [
      { key: 'total_chemical', label: 'Total chemical' },
      { key: 'total_water_l', label: 'Total water', unit: 'L' },
      { key: 'total_cost_zar', label: 'Cost', currency: true },
    ],
  },
  {
    type: 'fertilizer',
    label: 'Fertilizer rate',
    description: 'Product kg/ha from a nutrient target and the bag analysis.',
    fields: [
      { key: 'target_nutrient_kg_ha', label: 'Nutrient target', unit: 'kg/ha', required: true },
      { key: 'analysis_pct', label: 'Product analysis', unit: '%', required: true },
      { key: 'area_ha', label: 'Block area', unit: 'ha', required: true },
      { key: 'product', label: 'Product (catalogue name for cost)', type: 'select' },
    ],
    results: [
      { key: 'product_kg_ha', label: 'Product rate', unit: 'kg/ha' },
      { key: 'total_product_kg', label: 'Total product', unit: 'kg' },
      { key: 'total_cost_zar', label: 'Cost', currency: true },
    ],
  },
  {
    type: 'lime',
    label: 'Lime requirement',
    description: 'Guide tonnage from pH delta, CEC and texture — confirm with a soil lab.',
    fields: [
      { key: 'current_ph', label: 'Current pH', required: true },
      { key: 'target_ph', label: 'Target pH', required: true },
      { key: 'cec', label: 'CEC', unit: 'cmol/kg', required: true },
      {
        key: 'texture', label: 'Soil texture', type: 'select', required: true,
        options: [
          { value: 'sand', label: 'Sand' },
          { value: 'loam', label: 'Loam' },
          { value: 'clay', label: 'Clay' },
        ],
      },
      { key: 'area_ha', label: 'Block area', unit: 'ha', required: true },
      { key: 'product', label: 'Lime product (catalogue name for cost)', type: 'select' },
    ],
    results: [
      { key: 'lime_t_ha', label: 'Lime rate', unit: 't/ha' },
      { key: 'total_t', label: 'Total lime', unit: 't' },
      { key: 'total_cost_zar', label: 'Cost', currency: true },
    ],
  },
  {
    type: 'electrical',
    label: 'Pump sizing',
    description: 'kW required for a duty point, with the next standard motor size.',
    fields: [
      { key: 'flow_m3_h', label: 'Flow', unit: 'm³/h', required: true },
      { key: 'head_m', label: 'Total head', unit: 'm', required: true },
      { key: 'efficiency_pct', label: 'Pump efficiency', unit: '%', placeholder: '65' },
    ],
    results: [
      { key: 'kw_required', label: 'Power required', unit: 'kW' },
      { key: 'recommended_motor_kw', label: 'Recommended motor', unit: 'kW' },
    ],
  },
  {
    type: 'fluid',
    label: 'Pipe head loss',
    description: 'Hazen-Williams head loss and velocity for a pipe run.',
    fields: [
      { key: 'flow_m3_h', label: 'Flow', unit: 'm³/h', required: true },
      { key: 'length_m', label: 'Pipe length', unit: 'm', required: true },
      { key: 'diameter_mm', label: 'Pipe bore', unit: 'mm', required: true },
      { key: 'c_factor', label: 'C factor', placeholder: '150 (PVC)' },
    ],
    results: [
      { key: 'head_loss_m', label: 'Head loss', unit: 'm' },
      { key: 'head_loss_m_per_100m', label: 'Head loss per 100 m', unit: 'm' },
      { key: 'velocity_m_s', label: 'Velocity', unit: 'm/s' },
    ],
  },
];
