// Spec 2h.3 — enterprise comparison + data-quality API.
import { API_BASE_URL } from './config';
import type { EnterprisesReport, DataQualityReport } from '../types/reporting';

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function getEnterprisesReport(year: number): Promise<EnterprisesReport> {
  return request<EnterprisesReport>(`/reporting/enterprises?year=${year}`);
}

export async function getDataQuality(year: number): Promise<DataQualityReport> {
  return request<DataQualityReport>(`/reporting/data-quality?year=${year}`);
}
