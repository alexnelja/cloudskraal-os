import type { Farm, Field, FieldNote, MapLayer, FieldCostOfProduction } from '../types/farm';

import { API_BASE_URL } from './config';
const BASE_URL = API_BASE_URL;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function getFarms(): Promise<Farm[]> {
  return request<Farm[]>('/farms');
}

export async function getFields(params?: { farm_id?: string; enterprise?: string }): Promise<Field[]> {
  const qs = new URLSearchParams();
  if (params?.farm_id) qs.set('farm_id', params.farm_id);
  if (params?.enterprise) qs.set('enterprise', params.enterprise);
  const query = qs.toString();
  return request<Field[]>(`/fields${query ? `?${query}` : ''}`);
}

export async function getField(id: string): Promise<Field> {
  return request<Field>(`/fields/${id}`);
}

export async function updateField(id: string, data: Partial<Field>): Promise<Field> {
  return request<Field>(`/fields/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function getFarmBoundaries(): Promise<GeoJSON.FeatureCollection> {
  return request<GeoJSON.FeatureCollection>('/map/farm-boundaries');
}

export async function getMapGeoJSON(params?: { farm?: string; enterprise?: string }): Promise<GeoJSON.FeatureCollection> {
  const qs = new URLSearchParams();
  if (params?.farm) qs.set('farm', params.farm);
  if (params?.enterprise) qs.set('enterprise', params.enterprise);
  const query = qs.toString();
  return request<GeoJSON.FeatureCollection>(`/map/geojson${query ? `?${query}` : ''}`);
}

export async function getMapLayers(): Promise<MapLayer[]> {
  return request<MapLayer[]>('/map-layers');
}

export async function updateMapLayer(id: string, data: { visible?: boolean; opacity?: number }): Promise<MapLayer> {
  return request<MapLayer>(`/map-layers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function getFieldCostOfProduction(id: string, year?: number): Promise<FieldCostOfProduction> {
  const qs = year ? `?year=${year}` : '';
  return request<FieldCostOfProduction>(`/fields/${id}/cost-of-production${qs}`);
}

export async function createFieldNote(fieldId: string, data: { lat: number; lng: number; title?: string; body?: string; tags?: string[] }): Promise<FieldNote> {
  return request<FieldNote>(`/fields/${fieldId}/notes`, { method: 'POST', body: JSON.stringify(data) });
}

export interface CreateFieldInput {
  farm_id: string;
  name: string;
  enterprise: string;
  area_ha: number;
  crop_type?: string | null;
  planted_year?: string | null;
  status?: string | null;
  geometry?: string | null;
  notes?: string | null;
}

export async function createField(input: CreateFieldInput): Promise<Field> {
  return request<Field>('/fields', { method: 'POST', body: JSON.stringify(input) });
}
