import type {
  CalendarEvent,
  CalendarSummary,
  Task,
  TaskChecklist,
  TaskInput,
} from '../types/calendar';

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

// --- Calendar Events ---

export async function getCalendarEvents(params?: {
  month?: string;
  enterprise?: string;
}): Promise<CalendarEvent[]> {
  const qs = new URLSearchParams();
  if (params?.month) qs.set('month', params.month);
  if (params?.enterprise) qs.set('enterprise', params.enterprise);
  const query = qs.toString();
  return request<CalendarEvent[]>(`/calendar/events${query ? `?${query}` : ''}`);
}

export async function createCalendarEvent(
  data: Omit<CalendarEvent, 'id'>,
): Promise<CalendarEvent> {
  return request<CalendarEvent>('/calendar/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCalendarEvent(
  id: string,
  data: Partial<CalendarEvent>,
): Promise<CalendarEvent> {
  return request<CalendarEvent>(`/calendar/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await request<void>(`/calendar/events/${id}`, { method: 'DELETE' });
}

// --- Tasks ---

export async function getTasks(params?: {
  status?: string;
  enterprise?: string;
  field_id?: string;
  due_before?: string;
  due_after?: string;
}): Promise<Task[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.enterprise) qs.set('enterprise', params.enterprise);
  if (params?.field_id) qs.set('field_id', params.field_id);
  if (params?.due_before) qs.set('due_before', params.due_before);
  if (params?.due_after) qs.set('due_after', params.due_after);
  const query = qs.toString();
  return request<Task[]>(`/tasks${query ? `?${query}` : ''}`);
}

export async function getTask(id: string): Promise<Task> {
  return request<Task>(`/tasks/${id}`);
}

export async function createTask(
  data: Omit<Task, 'id' | 'completed_date' | 'completed_by' | 'inputs' | 'checklists' | 'depends_on_task'>,
): Promise<Task> {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTask(
  id: string,
  data: Partial<Task>,
): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await request<void>(`/tasks/${id}`, { method: 'DELETE' });
}

export async function completeTask(id: string): Promise<Task> {
  return request<Task>(`/tasks/${id}/complete`, { method: 'POST' });
}

// --- Task Inputs ---

export async function addTaskInput(
  taskId: string,
  data: Omit<TaskInput, 'id' | 'task_id'>,
): Promise<TaskInput> {
  return request<TaskInput>(`/tasks/${taskId}/inputs`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTaskInput(inputId: string): Promise<void> {
  await request<void>(`/task-inputs/${inputId}`, { method: 'DELETE' });
}

// --- Task Checklists ---

export async function addChecklistItem(
  taskId: string,
  data: Omit<TaskChecklist, 'id' | 'task_id'>,
): Promise<TaskChecklist> {
  return request<TaskChecklist>(`/tasks/${taskId}/checklists`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateChecklistItem(
  itemId: string,
  data: Partial<TaskChecklist>,
): Promise<TaskChecklist> {
  return request<TaskChecklist>(`/task-checklists/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteChecklistItem(itemId: string): Promise<void> {
  await request<void>(`/task-checklists/${itemId}`, { method: 'DELETE' });
}

// --- Convenience endpoints ---

export async function getOverdueTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks/overdue');
}

export async function getUpcomingTasks(days?: number): Promise<Task[]> {
  const qs = days !== undefined ? `?days=${days}` : '';
  return request<Task[]>(`/tasks/upcoming${qs}`);
}

export async function getCalendarSummary(month: string): Promise<CalendarSummary> {
  return request<CalendarSummary>(`/calendar/summary?month=${month}`);
}
