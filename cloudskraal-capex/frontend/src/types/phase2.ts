// EQUIPMENT
export interface Equipment {
  id: string;
  name: string;
  code: string | null;
  type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  farm_id: string | null;
  farm_name?: string;
  department: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
  status: string;
  hours_meter: number | null;
  next_service_date: string | null;
  notes: string | null;
  maintenance_logs?: MaintenanceLog[];
}

export interface MaintenanceLog {
  id: string;
  equipment_id: string;
  type: string;
  date: string;
  description: string | null;
  cost: number | null;
  performed_by: string | null;
  next_due_date: string | null;
  notes: string | null;
}

export interface EquipmentSummary {
  total: number;
  totalValue: number;
  overdueService: number;
  byType: Record<string, number>;
}

// LIVESTOCK
export interface LivestockGroup {
  id: string;
  name: string;
  enterprise: string;
  species: string;
  breed: string | null;
  management_type: string | null;
  head_count: number;
  current_field_id: string | null;
  average_weight_kg: number | null;
  notes: string | null;
  record_count?: number;
}

export interface LivestockRecord {
  id: string;
  group_id: string;
  record_type: string;
  date: string;
  details: string | null;
  head_count: number | null;
  product_used: string | null;
  cost: number | null;
  recorded_by: string | null;
  notes: string | null;
}

export interface BreedingSeason {
  id: string;
  group_id: string;
  group_name?: string;
  year: number;
  joining_start: string | null;
  joining_end: string | null;
  rams_used: number | null;
  ewes_joined: number | null;
  scanning_date: string | null;
  pregnant_count: number | null;
  dry_count: number | null;
  singles_count: number | null;
  twins_count: number | null;
  triplets_count: number | null;
  lambing_start: string | null;
  lambing_end: string | null;
  born_count: number | null;
  survived_count: number | null;
  weaned_count: number | null;
  weaning_date: string | null;
  weaning_percentage: number | null;
}

export interface ShearingRecord {
  id: string;
  group_id: string;
  group_name?: string;
  date: string;
  head_shorn: number | null;
  total_fleece_kg: number | null;
  avg_fleece_kg: number | null;
  micron_avg: number | null;
  yield_pct: number | null;
  grade: string | null;
  buyer: string | null;
  price_per_kg: number | null;
  total_revenue: number | null;
}

export interface LivestockDashboard {
  totalHead: number;
  groups: { name: string; count: number }[];
  upcomingEvents: string[];
  latestShearing: ShearingRecord | null;
}

// PRODUCTION
export interface ProductionBatch {
  id: string;
  batch_code: string;
  enterprise: string;
  product_type: string | null;
  source_field_ids: string | null;
  harvest_date_start: string | null;
  harvest_date_end: string | null;
  initial_quantity_kg: number | null;
  current_quantity_kg: number | null;
  status: string;
  quality_grade: string | null;
  storage_location: string | null;
  notes: string | null;
  steps?: ProcessingStep[];
  quality_tests?: QualityTest[];
  sales?: Sale[];
  step_count?: number;
  latest_step?: string;
}

export interface ProcessingStep {
  id: string;
  batch_id: string;
  step_number: number;
  step_type: string;
  start_datetime: string | null;
  end_datetime: string | null;
  facility: string | null;
  operator: string | null;
  input_quantity_kg: number | null;
  output_quantity_kg: number | null;
  loss_kg: number | null;
  parameters: string | null;
  quality_check_passed: boolean | null;
  notes: string | null;
}

export interface QualityTest {
  id: string;
  batch_id: string;
  test_type: string | null;
  test_date: string;
  tested_by: string | null;
  results: string | null;
  pass_fail: string | null;
  certificate_number: string | null;
}

export interface Sale {
  id: string;
  batch_id: string | null;
  customer: string;
  quantity_kg: number | null;
  unit_price: number | null;
  total_amount: number | null;
  currency: string;
  status: string;
  shipped_date: string | null;
  paid_date: string | null;
}

export interface ProductionDashboard {
  batchesByStatus: Record<string, number>;
  totalKgInPipeline: number;
  totalRevenue: number;
  recentBatches: ProductionBatch[];
}

// Colors
export const EQUIPMENT_TYPE_ICONS: Record<string, string> = {
  tractor: '\uD83D\uDE9C',
  processing: '\u2699\uFE0F',
  vehicle: '\uD83D\uDE97',
  equipment: '\uD83D\uDD27',
  irrigation: '\uD83D\uDCA7',
  tool: '\uD83D\uDD28',
};

export const BATCH_STATUS_COLORS: Record<string, string> = {
  received: '#9ca3af',
  processing: '#2563eb',
  graded: '#7c3aed',
  stored: '#d97706',
  sold: '#047857',
  shipped: '#059669',
};
