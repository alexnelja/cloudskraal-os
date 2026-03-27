import type {
  Project,
  ProjectSummary,
  CreateProjectPayload,
  UpdateProjectPayload,
  CashFlow,
  CashFlowPayload,
  Scenario,
  ScenarioPayload,
  DashboardStats,
} from '../types';

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

// Dashboard
export async function getDashboardStats(): Promise<DashboardStats> {
  return request<DashboardStats>('/dashboard/stats');
}

// Projects
export async function getProjects(): Promise<ProjectSummary[]> {
  return request<ProjectSummary[]>('/projects');
}

export async function getProject(id: string): Promise<Project> {
  return request<Project>(`/projects/${id}`);
}

export async function createProject(data: CreateProjectPayload): Promise<Project> {
  return request<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProject(id: string, data: UpdateProjectPayload): Promise<Project> {
  return request<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await request<void>(`/projects/${id}`, { method: 'DELETE' });
}

// Cash Flows
export async function getCashFlows(projectId: string): Promise<CashFlow[]> {
  return request<CashFlow[]>(`/projects/${projectId}/cashflows`);
}

export async function setCashFlows(projectId: string, cashFlows: CashFlowPayload[]): Promise<CashFlow[]> {
  return request<CashFlow[]>(`/projects/${projectId}/cashflows`, {
    method: 'PUT',
    body: JSON.stringify({ cashFlows }),
  });
}

// Scenarios
export async function getScenarios(projectId: string): Promise<Scenario[]> {
  return request<Scenario[]>(`/projects/${projectId}/scenarios`);
}

export async function createScenario(projectId: string, data: ScenarioPayload): Promise<Scenario> {
  return request<Scenario>(`/projects/${projectId}/scenarios`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateScenario(
  projectId: string,
  scenarioId: string,
  data: Partial<ScenarioPayload>
): Promise<Scenario> {
  return request<Scenario>(`/projects/${projectId}/scenarios/${scenarioId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteScenario(projectId: string, scenarioId: string): Promise<void> {
  await request<void>(`/projects/${projectId}/scenarios/${scenarioId}`, { method: 'DELETE' });
}

// Fact Sheet
export async function downloadFactSheet(projectId: string, scenarioId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/scenarios/${scenarioId}/factsheet`, {
    headers: { Accept: 'application/pdf' },
  });
  if (!res.ok) throw new Error('Failed to download fact sheet');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `factsheet-${projectId}-${scenarioId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
