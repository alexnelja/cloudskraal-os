import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ListView from './ListView';
import type { Task } from '../../types/calendar';
import type { Tag, TaskStatusConfig } from '../../types/taskManager';

const statuses: TaskStatusConfig[] = [
  { id: 's1', farm_id: 'farm1', name: 'To Do', color: '#9ca3af', category: 'active', sort_order: 0, is_default: 1 },
  { id: 's2', farm_id: 'farm1', name: 'In Progress', color: '#2563eb', category: 'active', sort_order: 1, is_default: 0 },
  { id: 's3', farm_id: 'farm1', name: 'Done', color: '#047857', category: 'done', sort_order: 2, is_default: 0 },
];

const tags: Tag[] = [
  { id: 'tag1', farm_id: 'farm1', name: 'Rooibos', color: '#d97706', group: 'enterprise', sort_order: 0, created_at: '' },
  { id: 'tag2', farm_id: 'farm1', name: 'Fencing', color: '#2563eb', group: 'category', sort_order: 1, created_at: '' },
];

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Spray rooibos field',
  description: null,
  enterprise: null,
  field_id: null,
  type: 'manual',
  status: 'pending',
  priority: 'medium',
  due_date: null,
  completed_date: null,
  completed_by: null,
  assigned_to: null,
  depends_on_task_id: null,
  recurrence_rule: null,
  calendar_event_id: null,
  notes: null,
  status_id: 's1',
  status_name: 'To Do',
  status_color: '#9ca3af',
  estimated_minutes: null,
  actual_minutes: null,
  blocked_reason: null,
  blocked_until: null,
  sort_order: 0,
  verified_by: null,
  verified_at: null,
  tags: [],
  ...overrides,
});

const defaultProps = {
  tasks: [] as Task[],
  statuses,
  tags,
  onStatusChange: vi.fn(),
  onDelete: vi.fn(),
  onSelectTask: vi.fn(),
};

describe('ListView', () => {
  it('renders table headers', () => {
    render(<ListView {...defaultProps} />);
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Due Date')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Field')).toBeInTheDocument();
    expect(screen.getByText('Assignee')).toBeInTheDocument();
  });

  it('renders task rows', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Spray rooibos field' }),
      makeTask({ id: 't2', title: 'Fix windmill pump' }),
    ];
    render(<ListView {...defaultProps} tasks={tasks} />);
    expect(screen.getByText('Spray rooibos field')).toBeInTheDocument();
    expect(screen.getByText('Fix windmill pump')).toBeInTheDocument();
  });

  it('shows empty state when no tasks match filters', () => {
    render(<ListView {...defaultProps} tasks={[]} />);
    expect(screen.getByText('No tasks match your filters')).toBeInTheDocument();
  });

  it('clicking header toggles sort', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Alpha task', priority: 'low' }),
      makeTask({ id: 't2', title: 'Beta task', priority: 'urgent' }),
    ];
    render(<ListView {...defaultProps} tasks={tasks} />);

    const titleHeader = screen.getByText('Title');
    fireEvent.click(titleHeader);
    // After click on Title, sorted asc by title
    const rows = screen.getAllByRole('row');
    // row 0 is header, row 1 should be Alpha, row 2 should be Beta
    expect(rows[1]).toHaveTextContent('Alpha task');
    expect(rows[2]).toHaveTextContent('Beta task');

    // Click again to reverse
    fireEvent.click(titleHeader);
    const rows2 = screen.getAllByRole('row');
    expect(rows2[1]).toHaveTextContent('Beta task');
    expect(rows2[2]).toHaveTextContent('Alpha task');
  });

  it('selecting tasks shows bulk action bar', () => {
    const tasks = [makeTask({ id: 't1', title: 'Task A' })];
    render(<ListView {...defaultProps} tasks={tasks} />);

    // Bulk bar not visible
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();

    // Select the task
    const checkbox = screen.getByLabelText('Select Task A');
    fireEvent.click(checkbox);

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByText('Change status')).toBeInTheDocument();
    expect(screen.getByText('Delete selected')).toBeInTheDocument();
  });

  it('bulk status dropdown shows statuses', () => {
    const tasks = [makeTask({ id: 't1', title: 'Task A' })];
    render(<ListView {...defaultProps} tasks={tasks} />);

    // Select and open bulk status dropdown
    fireEvent.click(screen.getByLabelText('Select Task A'));
    fireEvent.click(screen.getByText('Change status'));

    // All statuses visible in the dropdown
    // "To Do" already appears in the table row, so look for the dropdown buttons
    const buttons = screen.getAllByText('To Do');
    expect(buttons.length).toBeGreaterThanOrEqual(2); // one in row, one in dropdown
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Done').length).toBeGreaterThanOrEqual(1);
  });
});
