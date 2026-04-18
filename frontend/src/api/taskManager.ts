import type { Tag, TaskStatusConfig } from '../types/taskManager';

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

// --- Tags ---

export async function listTags(group?: string): Promise<Tag[]> {
  const qs = group ? `?group=${encodeURIComponent(group)}` : '';
  return request<Tag[]>(`/tags${qs}`);
}

export async function createTag(data: {
  name: string;
  color?: string;
  group?: string;
}): Promise<Tag> {
  return request<Tag>('/tags', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTag(
  id: string,
  data: Partial<Tag>,
): Promise<Tag> {
  return request<Tag>(`/tags/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTag(id: string): Promise<void> {
  await request<void>(`/tags/${id}`, { method: 'DELETE' });
}

// --- Task Statuses ---

export async function listStatuses(): Promise<TaskStatusConfig[]> {
  return request<TaskStatusConfig[]>('/task-statuses');
}

export async function createStatus(data: {
  name: string;
  color?: string;
  category: string;
}): Promise<TaskStatusConfig> {
  return request<TaskStatusConfig>('/task-statuses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateStatus(
  id: string,
  data: Partial<TaskStatusConfig>,
): Promise<TaskStatusConfig> {
  return request<TaskStatusConfig>(`/task-statuses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteStatus(id: string): Promise<void> {
  await request<void>(`/task-statuses/${id}`, { method: 'DELETE' });
}

// --- Task-Tag Linking ---

export async function addTagToTask(
  taskId: string,
  tagId: string,
): Promise<{ id: string; task_id: string; tag_id: string }> {
  return request<{ id: string; task_id: string; tag_id: string }>(
    `/tasks/${taskId}/tags/${tagId}`,
    { method: 'POST' },
  );
}

export async function removeTagFromTask(
  taskId: string,
  tagId: string,
): Promise<void> {
  await request<void>(`/tasks/${taskId}/tags/${tagId}`, { method: 'DELETE' });
}
