export interface Tag {
  id: string;
  farm_id: string;
  name: string;
  color: string;
  group: 'enterprise' | 'category' | 'custom';
  sort_order: number;
  created_at: string;
}

export interface TaskStatusConfig {
  id: string;
  farm_id: string;
  name: string;
  color: string;
  category: 'active' | 'done' | 'closed';
  sort_order: number;
  is_default: number;
}

export interface TaskTemplate {
  id: string;
  farm_id: string;
  name: string;
  description: string | null;
  tags: string | null;
  priority: string;
  estimated_minutes: number | null;
  checklist_items: string | null;
  input_defaults: string | null;
  recurrence_rule: string | null;
  created_at: string;
}
