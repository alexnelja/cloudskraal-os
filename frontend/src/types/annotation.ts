export type AnnotationType = 'line' | 'polygon' | 'pin';

export interface Annotation {
  id: string;
  type: AnnotationType;
  title: string;
  notes: string | null;
  geometry_json: string;
  geometry: GeoJSON.Geometry;
  length_m: number | null;
  area_m2: number | null;
  field_id: string | null;
  farm_id: string | null;
  created_at: string;
  updated_at: string;
  category: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CreateAnnotationInput {
  type: AnnotationType;
  title: string;
  notes?: string | null;
  geometry: GeoJSON.Geometry;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateAnnotationInput {
  title?: string;
  notes?: string | null;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
}
