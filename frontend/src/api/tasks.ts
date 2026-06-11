import { API_BASE_URL } from './config';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  enterprise: string | null;
  field_id: string | null;
  field_name?: string | null;
  annotation_id: string | null;
  type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  completed_date: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  notes?: string | null;
  priority?: 'low' | 'medium' | 'high';
  due_date?: string | null;
  field_id?: string | null;
  annotation_id?: string | null;
  enterprise?: string | null;
  assigned_to?: string | null;
  /** Spec 3.2 — template provenance; server freezes estimated_cost_zar on create */
  template_id?: string | null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listTasks(params?: { field_id?: string; annotation_id?: string; status?: string }): Promise<Task[]> {
  const qs = new URLSearchParams();
  if (params?.field_id) qs.set('field_id', params.field_id);
  if (params?.annotation_id) qs.set('annotation_id', params.annotation_id);
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString();
  return request<Task[]>(`/tasks${q ? `?${q}` : ''}`);
}

export function createTask(input: CreateTaskInput): Promise<Task> {
  return request<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteTask(id: string): Promise<void> {
  return request<void>(`/tasks/${id}`, { method: 'DELETE' });
}
