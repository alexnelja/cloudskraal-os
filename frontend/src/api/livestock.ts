import type { LivestockGroup, LivestockRecord, BreedingSeason, ShearingRecord, LivestockDashboard } from '../types/phase2';

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

export async function getLivestockGroups(): Promise<LivestockGroup[]> {
  return request<LivestockGroup[]>('/livestock/groups');
}

export async function getLivestockGroup(id: string): Promise<LivestockGroup> {
  return request<LivestockGroup>(`/livestock/groups/${id}`);
}

export async function updateLivestockGroup(id: string, data: Partial<LivestockGroup>): Promise<LivestockGroup> {
  return request<LivestockGroup>(`/livestock/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function addLivestockRecord(groupId: string, data: Partial<LivestockRecord>): Promise<LivestockRecord> {
  return request<LivestockRecord>(`/livestock/groups/${groupId}/records`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getBreedingSeasons(params?: { group_id?: string; year?: number }): Promise<BreedingSeason[]> {
  const qs = new URLSearchParams();
  if (params?.group_id) qs.set('group_id', params.group_id);
  if (params?.year) qs.set('year', String(params.year));
  const query = qs.toString();
  return request<BreedingSeason[]>(`/livestock/breeding-seasons${query ? `?${query}` : ''}`);
}

export async function createBreedingSeason(data: Partial<BreedingSeason>): Promise<BreedingSeason> {
  return request<BreedingSeason>('/livestock/breeding-seasons', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBreedingSeason(id: string, data: Partial<BreedingSeason>): Promise<BreedingSeason> {
  return request<BreedingSeason>(`/livestock/breeding-seasons/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function getShearingRecords(params?: { group_id?: string }): Promise<ShearingRecord[]> {
  const qs = new URLSearchParams();
  if (params?.group_id) qs.set('group_id', params.group_id);
  const query = qs.toString();
  return request<ShearingRecord[]>(`/livestock/shearing${query ? `?${query}` : ''}`);
}

export async function createShearingRecord(data: Partial<ShearingRecord>): Promise<ShearingRecord> {
  return request<ShearingRecord>('/livestock/shearing', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateShearingRecord(id: string, data: Partial<ShearingRecord>): Promise<ShearingRecord> {
  return request<ShearingRecord>(`/livestock/shearing/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function getLivestockDashboard(): Promise<LivestockDashboard> {
  return request<LivestockDashboard>('/livestock/dashboard');
}

// ── Spec COP UI — flock cost of production + transfer pricing ───────────────

export interface FlockCOP {
  group_id: string;
  year: number;
  costs: { feed: number; labour: number; animal_health: number; shearing: number; other: number; total: number };
  income: { wool: number; meat: number; wool_share: number | null };
  allocation: { wool: number | null; meat: number | null };
  denominators: { clean_wool_kg: number | null; liveweight_sold_kg: number | null };
  cost_per_kg_wool: number | null;
  cost_per_kg_liveweight: number | null;
  breeding?: Record<string, number | null>;
  cost_per_weaned_lamb?: number | null;
  cost_per_kg_weaned?: number | null;
  cost_per_ewe_mated?: number | null;
  gross_margin: number | null;
  gross_margin_per_ewe: number | null;
  transfers_in?: { total: number; items: unknown[] };
  warnings: string[];
}

export async function getFlockCostOfProduction(groupId: string, year: number): Promise<FlockCOP> {
  return request<FlockCOP>(`/livestock/groups/${groupId}/cost-of-production?year=${year}`);
}

export async function getTransferPricingMode(): Promise<{ mode: 'at_cost' | 'at_market' }> {
  return request<{ mode: 'at_cost' | 'at_market' }>('/livestock/transfer-pricing-mode');
}

export async function setTransferPricingMode(mode: 'at_cost' | 'at_market'): Promise<{ mode: string }> {
  return request<{ mode: string }>('/livestock/transfer-pricing-mode', {
    method: 'PUT',
    body: JSON.stringify({ mode }),
  });
}
