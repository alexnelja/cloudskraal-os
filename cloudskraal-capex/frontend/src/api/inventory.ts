import type { InputProduct, InventorySummary, InventoryTransaction } from '../types/phase3';

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

export async function getTransactions(productId?: string): Promise<InventoryTransaction[]> {
  if (productId) {
    return request<InventoryTransaction[]>(`/inventory/products/${productId}/transactions`);
  }
  return request<InventoryTransaction[]>('/inventory/transactions');
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
