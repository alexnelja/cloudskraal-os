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

export interface GaugeSpec {
  resultKey: string;
  min: number;
  max: number;
  goodMin?: number;
  goodMax?: number;
  threshold?: number;
  unit?: string;
  ticks?: { value: number; label: string }[];
}

export type VisualSpec =
  | { kind: 'gauge'; gauge: GaugeSpec }
  | { kind: 'gauge+schematic'; gauge: GaugeSpec; schematic: 'sprayer' | 'pipe' | 'pump' }
  | { kind: 'tankmix' };

// Standard IEC motor ladder — mirrors backend electrical.js. The pump gauge
// ticks must be a subset of this so every recommendation lands on a real tick.
export const MOTOR_LADDER = [
  0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132,
] as const;

export interface CalcDef {
  type: string;
  label: string;
  description: string;
  fields: CalcField[];
  results: CalcResultRow[];
  visual?: VisualSpec;
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
    visual: { kind: 'gauge+schematic', schematic: 'sprayer', gauge: { resultKey: 'application_l_ha', min: 0, max: 600, goodMin: 100, goodMax: 400, threshold: 600, unit: 'L/ha' } },
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
    visual: { kind: 'tankmix' },
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
    visual: { kind: 'gauge', gauge: { resultKey: 'product_kg_ha', min: 0, max: 1000, goodMin: 0, goodMax: 800, threshold: 1000, unit: 'kg/ha' } },
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
    visual: { kind: 'gauge', gauge: { resultKey: 'lime_t_ha', min: 0, max: 10, goodMin: 0, goodMax: 8, threshold: 8, unit: 't/ha' } },
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
    visual: { kind: 'gauge+schematic', schematic: 'pump', gauge: { resultKey: 'kw_required', min: 0, max: 132, unit: 'kW', ticks: [ { value: 1.1, label: '1.1' }, { value: 2.2, label: '2.2' }, { value: 4, label: '4' }, { value: 7.5, label: '7.5' }, { value: 11, label: '11' }, { value: 22, label: '22' }, { value: 45, label: '45' }, { value: 90, label: '90' }, { value: 132, label: '132' } ] } },
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
    visual: { kind: 'gauge+schematic', schematic: 'pipe', gauge: { resultKey: 'velocity_m_s', min: 0, max: 3, goodMin: 0, goodMax: 2, threshold: 2, unit: 'm/s' } },
  },
];
