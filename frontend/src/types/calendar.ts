export interface CalendarEvent {
  id: string;
  title: string;
  enterprise: string | null;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  recurrence_rule: string | null;
  color: string | null;
  notes: string | null;
}

export type TaskType = 'scheduled' | 'triggered' | 'dependent' | 'manual';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'overdue';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  enterprise: string | null;
  field_id: string | null;
  field_name?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_date: string | null;
  completed_by: string | null;
  assigned_to: string | null;
  depends_on_task_id: string | null;
  depends_on_task?: { id: string; title: string; status: string } | null;
  recurrence_rule: string | null;
  calendar_event_id: string | null;
  notes: string | null;
  status_id: string | null;
  status_name?: string;
  status_color?: string;
  status_category?: string;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  blocked_reason: string | null;
  blocked_until: string | null;
  sort_order: number;
  verified_by: string | null;
  verified_at: string | null;
  tags?: Array<{ id: string; name: string; color: string; group: string }>;
  inputs?: TaskInput[];
  checklists?: TaskChecklist[];
}

export interface TaskInput {
  id: string;
  task_id: string;
  product_name: string;
  category: string | null;
  rate: number | null;
  rate_unit: string | null;
  total_applied: number | null;
  total_unit: string | null;
  cost_per_unit: number | null;
  total_cost: number | null;
}

export interface TaskChecklist {
  id: string;
  task_id: string;
  item: string;
  checked: boolean;
  sort_order: number;
}

export interface CalendarSummary {
  events: CalendarEvent[];
  tasks: Task[];
}

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#dc2626',
  high: '#d97706',
  medium: '#2563eb',
  low: '#9ca3af',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: '#9ca3af',
  in_progress: '#2563eb',
  completed: '#047857',
  skipped: '#6b7280',
  overdue: '#dc2626',
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  triggered: 'Triggered',
  dependent: 'Dependent',
  manual: 'Manual',
};
