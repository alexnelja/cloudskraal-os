// Spec 6b — calculators API.
import { API_BASE_URL } from './config';

export interface CalcResponse {
  result: Record<string, number | string | null>;
  breakdown?: string;
  warnings: string[];
  error?: string;
}

export async function computeCalculator(
  type: string,
  inputs: Record<string, number | string>,
): Promise<CalcResponse> {
  const res = await fetch(`${API_BASE_URL}/calculators/${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs),
  });
  const data = await res.json();
  if (!res.ok && !data.error) throw new Error(`API error ${res.status}`);
  return data;
}

export async function getInputProductNames(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/inventory/products`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map((r: { name: string }) => r.name).filter(Boolean) : [];
}
