import { API_BASE_URL } from './config';
import type {
  Annotation,
  AnnotationType,
  CreateAnnotationInput,
  UpdateAnnotationInput,
} from '../types/annotation';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function listAnnotations(params?: {
  type?: AnnotationType;
  field_id?: string;
}): Promise<Annotation[]> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.field_id) qs.set('field_id', params.field_id);
  const q = qs.toString();
  return request<Annotation[]>(`/annotations${q ? `?${q}` : ''}`);
}

export async function getAnnotation(id: string): Promise<Annotation> {
  return request<Annotation>(`/annotations/${id}`);
}

export async function createAnnotation(input: CreateAnnotationInput): Promise<Annotation> {
  return request<Annotation>('/annotations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAnnotation(
  id: string,
  patch: UpdateAnnotationInput,
): Promise<Annotation> {
  return request<Annotation>(`/annotations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteAnnotation(id: string): Promise<void> {
  await request<void>(`/annotations/${id}`, { method: 'DELETE' });
}
