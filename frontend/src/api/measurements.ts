import type { Measurement } from '../types/measurement';
import { API_BASE_URL } from './config';

const API = `${API_BASE_URL}/measurements`;

export async function listMeasurements(): Promise<Measurement[]> {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

export async function createMeasurement(
  input: Omit<Measurement, 'id' | 'created_at'>,
): Promise<Measurement> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  return res.json();
}

export async function deleteMeasurement(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`);
}
