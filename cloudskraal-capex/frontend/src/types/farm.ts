export interface Farm {
  id: string;
  name: string;
  code: string;
  type: 'owned' | 'leased' | 'prospect';
  total_ha: number;
  lat: number;
  lng: number;
  region: string;
  notes: string | null;
  field_count?: number;
}

export interface Field {
  id: string;
  farm_id: string;
  farm_name?: string;
  name: string;
  code: string | null;
  enterprise: string;
  crop_type: string | null;
  area_ha: number;
  planted_year: string | null;
  status: string;
  soil_type: string | null;
  irrigation_type: string | null;
  notes: string | null;
  production?: FieldProduction[];
  field_notes?: FieldNote[];
}

export interface FieldProduction {
  id: string;
  field_id: string;
  year: number;
  estimated_yield_kg: number | null;
  actual_yield_kg: number | null;
  stand_pct: number | null;
}

export interface FieldNote {
  id: string;
  field_id: string;
  lat: number;
  lng: number;
  title: string | null;
  body: string | null;
  photo_path: string | null;
  tags: string[];
  created_by: string | null;
  created_at: string;
}

export interface MapLayer {
  id: string;
  name: string;
  source_url: string;
  source_type: 'arcgis_tiles' | 'wms' | 'geojson';
  category: string;
  visible: boolean;
  opacity: number;
  z_index: number;
}

export type Enterprise = 'rooibos' | 'wine' | 'sheep' | 'buchu' | 'sceletium' | 'grazing' | 'fallow' | 'farm_boundary' | 'other' | 'unclassified';

export const ENTERPRISE_COLORS: Record<string, string> = {
  rooibos: '#047857',
  wine: '#7c3aed',
  sheep: '#d97706',
  buchu: '#0d9488',
  sceletium: '#059669',
  grazing: '#a16207',
  fallow: '#9ca3af',
  farm_boundary: '#374151',
  other: '#6b7280',
  unclassified: '#d1d5db',
};

// Cost of Production types
export interface FieldInputTransaction {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  unit_of_measure: string;
  type: string;
  date: string;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  field_id: string;
  notes: string | null;
}

export interface FieldTaskInput {
  id: string;
  task_id: string;
  task_title: string;
  due_date: string | null;
  completed_date: string | null;
  task_status: string;
  product_name: string;
  category: string;
  rate: number | null;
  rate_unit: string | null;
  total_applied: number | null;
  total_unit: string | null;
  cost_per_unit: number | null;
  total_cost: number | null;
}

export interface FieldLabourEntry {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_role: string;
  date: string;
  hours_worked: number;
  activity_type: string;
  hourly_rate: number | null;
  monthly_salary: number | null;
  notes: string | null;
}

export interface FieldTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  completed_date: string | null;
  enterprise: string;
}

export interface FieldCostSummary {
  total_input_cost: number;
  total_task_input_cost: number;
  total_labour_cost: number;
  total_labour_hours: number;
  total_cost: number;
  cost_per_ha: number;
  total_yield_kg: number;
  yield_per_ha: number;
  cost_per_kg: number | null;
}

export interface StandTrendPoint {
  year: number;
  stand_pct: number;
}

export interface FieldRotation {
  planted_year: number;
  rotation_year: number;
  phase: 'establishment' | 'topping' | 'production' | 'end_of_life';
  current_stand_pct: number | null;
  stand_trend: StandTrendPoint[];
  replant_status: 'ok' | 'can_delay' | 'must_replant' | 'warning';
  replant_message: string | null;
}

export interface FieldCostOfProduction {
  field: Field;
  production: FieldProduction[];
  inputs: FieldInputTransaction[];
  taskInputs: FieldTaskInput[];
  labour: FieldLabourEntry[];
  tasks: FieldTask[];
  summary: FieldCostSummary;
  rotation: FieldRotation | null;
}

export const ENTERPRISE_LABELS: Record<string, string> = {
  rooibos: 'Rooibos',
  wine: 'Wine / Grapes',
  sheep: 'Sheep / Grazing',
  buchu: 'Buchu',
  sceletium: 'Sceletium',
  grazing: 'Natural Veld',
  fallow: 'Fallow',
  farm_boundary: 'Farm Boundary',
  other: 'Other',
  unclassified: 'Unclassified',
};
