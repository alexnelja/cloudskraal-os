import type { ProductionBatch, ProcessingStep, QualityTest, Sale, ProductionDashboard } from '../types/phase2';

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

export async function getBatches(params?: { enterprise?: string; status?: string }): Promise<ProductionBatch[]> {
  const qs = new URLSearchParams();
  if (params?.enterprise) qs.set('enterprise', params.enterprise);
  if (params?.status) qs.set('status', params.status);
  const query = qs.toString();
  return request<ProductionBatch[]>(`/production/batches${query ? `?${query}` : ''}`);
}

export async function getBatch(id: string): Promise<ProductionBatch> {
  return request<ProductionBatch>(`/production/batches/${id}`);
}

export async function createBatch(data: Partial<ProductionBatch>): Promise<ProductionBatch> {
  return request<ProductionBatch>('/production/batches', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBatch(id: string, data: Partial<ProductionBatch>): Promise<ProductionBatch> {
  return request<ProductionBatch>(`/production/batches/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function addProcessingStep(batchId: string, data: Partial<ProcessingStep>): Promise<ProcessingStep> {
  return request<ProcessingStep>(`/production/batches/${batchId}/steps`, { method: 'POST', body: JSON.stringify(data) });
}

export async function addQualityTest(batchId: string, data: Partial<QualityTest>): Promise<QualityTest> {
  return request<QualityTest>(`/production/batches/${batchId}/quality`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getSales(params?: { batch_id?: string; status?: string }): Promise<Sale[]> {
  const qs = new URLSearchParams();
  if (params?.batch_id) qs.set('batch_id', params.batch_id);
  if (params?.status) qs.set('status', params.status);
  const query = qs.toString();
  return request<Sale[]>(`/production/sales${query ? `?${query}` : ''}`);
}

export async function createSale(data: Partial<Sale>): Promise<Sale> {
  return request<Sale>('/production/sales', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateSale(id: string, data: Partial<Sale>): Promise<Sale> {
  return request<Sale>(`/production/sales/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function getProductionDashboard(): Promise<ProductionDashboard> {
  return request<ProductionDashboard>('/production/dashboard');
}
