import type { Employee, EmployeeSummary, TimeEntry } from '../types/phase3';

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

export async function getEmployees(params?: { type?: string; department?: string; status?: string }): Promise<Employee[]> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.department) qs.set('department', params.department);
  if (params?.status) qs.set('status', params.status);
  const query = qs.toString();
  return request<Employee[]>(`/employees${query ? `?${query}` : ''}`);
}

export async function getEmployeeById(id: string): Promise<Employee> {
  return request<Employee>(`/employees/${id}`);
}

export async function getEmployeeSummary(): Promise<EmployeeSummary> {
  return request<EmployeeSummary>('/employees/summary');
}

export async function updateEmployee(id: string, data: Partial<Employee>): Promise<Employee> {
  return request<Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function addTimeEntry(employeeId: string, data: Partial<TimeEntry>): Promise<TimeEntry> {
  return request<TimeEntry>(`/employees/${employeeId}/time`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
