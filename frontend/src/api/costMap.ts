// Spec 2h.2 — cost node map + enterprise summary API.
import { API_BASE_URL } from './config';
import type { CostNodeMap, EnterpriseSummary, IncludeFlag } from '../types/costMap';

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

export async function getCostNodeMap(
  fieldId: string,
  year: number,
  include: IncludeFlag[],
  denominator?: string,
): Promise<CostNodeMap> {
  const qs = new URLSearchParams({ year: String(year) });
  if (include.length) qs.set('include', include.join(','));
  if (denominator) qs.set('denominator', denominator);
  return request<CostNodeMap>(`/fields/${fieldId}/cost-node-map?${qs}`);
}

export async function getEnterpriseSummary(
  enterprise: string,
  year: number,
  include: IncludeFlag[],
  denominator?: string,
): Promise<EnterpriseSummary> {
  const qs = new URLSearchParams({ year: String(year), enterprise });
  if (include.length) qs.set('include', include.join(','));
  if (denominator) qs.set('denominator', denominator);
  return request<EnterpriseSummary>(`/reporting/enterprise-summary?${qs}`);
}
