import type { FinancialDashboard, FinancialTransaction, Enterprise } from '../types/phase3';

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

export async function getFinancialDashboard(): Promise<FinancialDashboard> {
  return request<FinancialDashboard>('/financials/dashboard');
}

export async function getFinancialTransactions(params?: {
  enterprise_id?: string;
  type?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
}): Promise<FinancialTransaction[]> {
  const qs = new URLSearchParams();
  if (params?.enterprise_id) qs.set('enterprise_id', params.enterprise_id);
  if (params?.type) qs.set('type', params.type);
  if (params?.category) qs.set('category', params.category);
  if (params?.date_from) qs.set('date_from', params.date_from);
  if (params?.date_to) qs.set('date_to', params.date_to);
  const query = qs.toString();
  return request<FinancialTransaction[]>(`/financials/transactions${query ? `?${query}` : ''}`);
}

export async function getEnterprises(): Promise<Enterprise[]> {
  return request<Enterprise[]>('/financials/enterprises');
}
