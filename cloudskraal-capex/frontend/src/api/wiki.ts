import type { WikiPage, WikiPageSummary, WikiGraphData } from '../types/wiki';

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

export async function getWikiPages(params?: {
  category?: string;
  enterprise?: string;
  search?: string;
  tag?: string;
}): Promise<WikiPageSummary[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.enterprise) qs.set('enterprise', params.enterprise);
  if (params?.search) qs.set('search', params.search);
  if (params?.tag) qs.set('tag', params.tag);
  const query = qs.toString();
  return request<WikiPageSummary[]>(`/wiki${query ? `?${query}` : ''}`);
}

export async function getWikiPage(slug: string): Promise<WikiPage> {
  return request<WikiPage>(`/wiki/${slug}`);
}

export async function createWikiPage(data: {
  title: string;
  body: string;
  category?: string;
  enterprise?: string;
  tags?: string[];
}): Promise<WikiPage> {
  return request<WikiPage>('/wiki', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateWikiPage(
  slug: string,
  data: { title?: string; body?: string; category?: string; enterprise?: string; tags?: string[]; aliases?: string[]; pinned?: boolean },
): Promise<WikiPage> {
  return request<WikiPage>(`/wiki/${slug}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteWikiPage(slug: string): Promise<void> {
  await request<void>(`/wiki/${slug}`, { method: 'DELETE' });
}

export async function getWikiGraph(): Promise<WikiGraphData> {
  return request<WikiGraphData>('/wiki/graph');
}

export async function searchWiki(q: string): Promise<WikiPageSummary[]> {
  return request<WikiPageSummary[]>(`/wiki?search=${encodeURIComponent(q)}`);
}

export interface WikiRevision {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export async function getWikiHistory(slug: string): Promise<WikiRevision[]> {
  return request<WikiRevision[]>(`/wiki/${slug}/history`);
}

export async function getDailyNote(date: string): Promise<WikiPage> {
  return request<WikiPage>(`/wiki/daily/${date}`);
}

export async function reorderWikiPages(items: { slug: string; sort_order: number }[]): Promise<void> {
  await request<{ ok: boolean }>('/wiki-reorder', {
    method: 'PATCH',
    body: JSON.stringify({ items }),
  });
}

export async function getWikiTags(): Promise<{ tag: string; count: number }[]> {
  return request<{ tag: string; count: number }[]>('/wiki-tags');
}
