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
