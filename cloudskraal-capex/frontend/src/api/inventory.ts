import type { InputProduct, InventorySummary, InventoryTransaction, InventoryStock } from '../types/phase3';

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

export async function getProducts(params?: { category?: string }): Promise<InputProduct[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  const query = qs.toString();
  return request<InputProduct[]>(`/inventory/products${query ? `?${query}` : ''}`);
}

export async function getProductById(id: string): Promise<InputProduct> {
  return request<InputProduct>(`/inventory/products/${id}`);
}

export async function getInventorySummary(): Promise<InventorySummary> {
  return request<InventorySummary>('/inventory/summary');
}

export async function getStock(): Promise<InventoryStock[]> {
  return request<InventoryStock[]>('/inventory/stock');
}

export async function getTransactions(productId?: string): Promise<InventoryTransaction[]> {
  const qs = new URLSearchParams();
  if (productId) qs.set('product_id', productId);
  const query = qs.toString();
  return request<InventoryTransaction[]>(`/inventory/transactions${query ? `?${query}` : ''}`);
}

export async function recordTransaction(data: {
  product_id: string;
  type: string;
  date: string;
  quantity: number;
  unit_cost?: number | null;
  notes?: string | null;
}): Promise<InventoryTransaction> {
  return request<InventoryTransaction>('/inventory/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
