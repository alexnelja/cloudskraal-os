// Spec 3.2 — usage-filtered task suggestions for a field.
import { API_BASE_URL } from './config';

export interface SuggestionInput {
  product: string;
  rate_per_ha: number;
  unit: string;
  quantity: number;
  cost: number | null;
}

export interface TaskSuggestion {
  template_id: string;
  op_type: string;
  name: string;
  notes: string | null;
  default_duration_hrs: number | null;
  inputs: SuggestionInput[];
  estimated_cost_zar: number;
  cost_warnings: string[];
  suggested_assignee: string | null;
}

export interface FieldTaskSuggestions {
  field_id: string;
  usage: string | null;
  area_ha: number;
  suggestions: TaskSuggestion[];
}

export async function getTaskSuggestions(fieldId: string): Promise<FieldTaskSuggestions> {
  const res = await fetch(`${API_BASE_URL}/fields/${fieldId}/task-suggestions`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
