import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TodayView from './TodayView';
import type { Task } from '../../types/calendar';
import type { Tag, TaskStatusConfig } from '../../types/taskManager';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    li: ({ children, ...props }: any) => <li {...props}>{children}</li>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('@phosphor-icons/react', () => ({
  Check: (props: any) => <svg data-testid="check-icon" {...props} />,
  SunHorizon: (props: any) => <svg data-testid="sun-icon" {...props} />,
}));

function localDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const today = localDateStr(0);
const yesterday = localDateStr(-1);
const tomorrow = localDateStr(1);

const statuses: TaskStatusConfig[] = [
  { id: 's1', farm_id: 'farm1', name: 'To Do', color: '#9ca3af', category: 'active', sort_order: 0, is_default: 1 },
];

const tags: Tag[] = [
  { id: 'tag1', farm_id: 'farm1', name: 'Rooibos', color: '#d97706', group: 'enterprise', sort_order: 0, created_at: '' },
  { id: 'tag2', farm_id: 'farm1', name: 'Spraying', color: '#2563eb', group: 'category', sort_order: 1, created_at: '' },
];

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'Test task',
    description: null,
    enterprise: null,
    field_id: null,
    type: 'scheduled',
    status: 'pending',
    priority: 'medium',
    due_date: today,
    completed_date: null,
    completed_by: null,
    assigned_to: null,
    depends_on_task_id: null,
    recurrence_rule: null,
    calendar_event_id: null,
    notes: null,
    status_id: 's1',
    estimated_minutes: null,
    actual_minutes: null,
    blocked_reason: null,
    blocked_until: null,
    sort_order: 0,
    verified_by: null,
    verified_at: null,
    tags: [],
    ...overrides,
  };
}

describe('TodayView', () => {
  it('renders task list grouped by date', () => {
    const tasks = [
      makeTask({ id: 'overdue1', title: 'Overdue task', due_date: yesterday }),
      makeTask({ id: 'today1', title: 'Today task', due_date: today }),
      makeTask({ id: 'tomorrow1', title: 'Tomorrow task', due_date: tomorrow }),
    ];
    render(
      <TodayView
        tasks={tasks}
        statuses={statuses}
        tags={tags}
        onComplete={vi.fn()}
        onSelectTask={vi.fn()}
        selectedTaskId={null}
      />,
    );
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    // "Today" appears as both a group header and a due-date label
    expect(screen.getAllByText('Today').length).toBeGreaterThanOrEqual(1);
    // "Tomorrow" appears as both a group header and a due-date label
    expect(screen.getAllByText('Tomorrow').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Overdue task')).toBeInTheDocument();
    expect(screen.getByText('Today task')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow task')).toBeInTheDocument();
  });

  it('shows empty state when no tasks', () => {
    render(
      <TodayView
        tasks={[]}
        statuses={statuses}
        tags={tags}
        onComplete={vi.fn()}
        onSelectTask={vi.fn()}
        selectedTaskId={null}
      />,
    );
    expect(screen.getByText(/no tasks for today/i)).toBeInTheDocument();
  });

  it('tag filter pills filter displayed tasks', () => {
    const tasks = [
      makeTask({
        id: 't1',
        title: 'Rooibos task',
        due_date: today,
        tags: [{ id: 'tag1', name: 'Rooibos', color: '#d97706', group: 'enterprise' }],
      }),
      makeTask({
        id: 't2',
        title: 'Spraying task',
        due_date: today,
        tags: [{ id: 'tag2', name: 'Spraying', color: '#2563eb', group: 'category' }],
      }),
    ];
    render(
      <TodayView
        tasks={tasks}
        statuses={statuses}
        tags={tags}
        onComplete={vi.fn()}
        onSelectTask={vi.fn()}
        selectedTaskId={null}
      />,
    );
    // Both visible initially
    expect(screen.getByText('Rooibos task')).toBeInTheDocument();
    expect(screen.getByText('Spraying task')).toBeInTheDocument();

    // Click "Rooibos" filter pill
    const rooibosPill = screen.getByRole('button', { name: /rooibos/i });
    fireEvent.click(rooibosPill);

    // Only rooibos task visible
    expect(screen.getByText('Rooibos task')).toBeInTheDocument();
    expect(screen.queryByText('Spraying task')).not.toBeInTheDocument();
  });
});
