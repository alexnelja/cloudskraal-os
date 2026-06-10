// Spec 2h.2 — types mirroring backend services/cost_node_map.js payloads.

export type LayerKey =
  | 'direct_inputs' | 'labour' | 'shared' | 'activities'
  | 'overhead' | 'capital' | 'processing';

export type IncludeFlag = 'shared' | 'activities' | 'overhead' | 'capital' | 'processing';

export type LayerStatus = 'ok' | 'off' | 'no_data';

export interface CostMapNode {
  id: string;
  kind: 'layer' | 'leaf' | 'total' | 'denominator' | 'unit_cost' | 'price' | 'margin';
  label: string;
  layer?: LayerKey;
  status?: LayerStatus;
  value_zar?: number | null;
  value_kg?: number;
  value_zar_per_kg?: number | null;
  include_flag?: IncludeFlag | null;
  toggleable?: boolean;
  data_exists?: boolean;
  hint?: string;
  denominator?: string;
  price_basis?: string;
}

export interface CostMapEdge { source: string; target: string }

export interface CostMapSummary {
  total_direct: number;
  total_loaded: number;
  yield_kg: number;
  yield_at_price_basis_kg?: number | null;
  cost_per_kg_direct: number | null;
  cost_per_kg_loaded: number | null;
  price_per_kg: number | null;
  price_basis: string | null;
  enabled_layers: LayerKey[];
}

export interface CostNodeMap {
  field_id: string;
  year: number;
  enterprise: string;
  usage?: string;
  denominator: string;
  nodes: CostMapNode[];
  edges: CostMapEdge[];
  summary: CostMapSummary;
  warnings: string[];
  error?: string;
}

export interface EnterpriseSummaryField {
  field_id: string;
  name: string;
  total_cost: number;
  yield_kg: number;
  cost_per_kg: number | null;
}

export interface EnterpriseSummary {
  enterprise: string;
  year: number;
  include: string[];
  total_cost: number;
  total_yield_kg: number;
  cost_per_kg: number | null;
  price_per_kg: number | null;
  margin_per_kg: number | null;
  fields: EnterpriseSummaryField[];
}
