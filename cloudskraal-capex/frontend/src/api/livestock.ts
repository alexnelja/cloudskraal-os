import type { LivestockGroup, LivestockRecord, BreedingSeason, ShearingRecord, LivestockDashboard } from '../types/phase2';

const BASE_URL = 'http://localhost:3001/api';

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
  return request<BreedingSeason[]>(`/livestock/breeding${query ? `?${query}` : ''}`);
}

export async function createBreedingSeason(data: Partial<BreedingSeason>): Promise<BreedingSeason> {
  return request<BreedingSeason>('/livestock/breeding', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBreedingSeason(id: string, data: Partial<BreedingSeason>): Promise<BreedingSeason> {
  return request<BreedingSeason>(`/livestock/breeding/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
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

export async function getLivestockDashboard(): Promise<LivestockDashboard> {
  return request<LivestockDashboard>('/livestock/dashboard');
}
