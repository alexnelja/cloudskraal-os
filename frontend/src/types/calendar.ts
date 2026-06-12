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

export type TaskLifecycleState = 'scheduled' | 'in_progress' | 'completed' | 'verified' | 'cancelled';

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
  /** Spec 4.1 lifecycle state machine: scheduled|in_progress|completed|verified|cancelled */
  state?: TaskLifecycleState | null;
  actual_start?: string | null;
  actual_end?: string | null;
  actual_inputs_json?: string | null;
  actual_duration_hrs?: number | null;
  actual_area_ha?: number | null;
  cancelled_reason?: string | null;
  template_id?: string | null;
  estimated_cost_zar?: number | null;
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

/**
 * Token-driven palette — each entry points at a CSS custom property so the
 * color themes automatically with the MD3 system tokens (incl. dark mode).
 * If a consumer needs the raw value, fall back to `getComputedStyle` on the
 * document root.
 */
export const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--md-sys-color-error)',
  high: 'var(--md-sys-color-tertiary)',
  medium: 'var(--md-sys-color-primary)',
  low: 'var(--md-sys-color-outline)',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--md-sys-color-outline)',
  in_progress: 'var(--md-sys-color-primary)',
  completed: 'var(--md-sys-color-primary)',
  skipped: 'var(--md-sys-color-on-surface-variant)',
  overdue: 'var(--md-sys-color-error)',
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  triggered: 'Triggered',
  dependent: 'Dependent',
  manual: 'Manual',
};
