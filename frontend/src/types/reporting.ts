// Spec 2h.3 — types mirroring backend services/reporting.js payloads.

export interface EnterpriseRow {
  enterprise: string;
  fields_count: number;
  area_ha: number;
  yield_kg: number;
  cost_variable: number;
  cost_loaded: number;
  cost_per_kg_variable: number | null;
  cost_per_kg_loaded: number | null;
  price_per_kg: number | null;
  margin_per_kg: number | null;
}

export interface FlockRow {
  flock_id: string;
  name: string;
  cost_per_kg_wool: number | null;
  cost_per_kg_liveweight: number | null;
  gross_margin_per_ewe: number | null;
}

export interface EnterprisesReport {
  year: number;
  enterprises: EnterpriseRow[];
  flocks: FlockRow[];
}

export interface DataQualityReport {
  year: number;
  fields_scanned: number;
  uncategorized: {
    total_zar: number;
    fields: { field_id: string; name: string; amount: number }[];
  };
  costed_no_yield: { field_id: string; name: string; usage: string; total_cost: number }[];
  warning_counts: Record<string, number>;
  excluded_layers: Record<string, number>;
}
