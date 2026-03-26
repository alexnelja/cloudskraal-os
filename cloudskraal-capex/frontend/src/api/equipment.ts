import type { Equipment, MaintenanceLog, EquipmentSummary } from '../types/phase2';

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

export async function getEquipment(params?: { farm_id?: string; type?: string; status?: string }): Promise<Equipment[]> {
  const qs = new URLSearchParams();
  if (params?.farm_id) qs.set('farm_id', params.farm_id);
  if (params?.type) qs.set('type', params.type);
  if (params?.status) qs.set('status', params.status);
  const query = qs.toString();
  return request<Equipment[]>(`/equipment${query ? `?${query}` : ''}`);
}

export async function getEquipmentById(id: string): Promise<Equipment> {
  return request<Equipment>(`/equipment/${id}`);
}

export async function createEquipment(data: Partial<Equipment>): Promise<Equipment> {
  return request<Equipment>('/equipment', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateEquipment(id: string, data: Partial<Equipment>): Promise<Equipment> {
  return request<Equipment>(`/equipment/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function addMaintenanceLog(equipmentId: string, data: Partial<MaintenanceLog>): Promise<MaintenanceLog> {
  return request<MaintenanceLog>(`/equipment/${equipmentId}/maintenance`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getEquipmentAlerts(): Promise<Equipment[]> {
  return request<Equipment[]>('/equipment/alerts');
}

export async function getEquipmentSummary(): Promise<EquipmentSummary> {
  return request<EquipmentSummary>('/equipment/summary');
}
