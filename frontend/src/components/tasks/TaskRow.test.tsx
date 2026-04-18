import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TaskRow from './TaskRow';
import type { Task } from '../../types/calendar';
import type { TaskStatusConfig } from '../../types/taskManager';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    li: ({ children, ...props }: any) => <li {...props}>{children}</li>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('@phosphor-icons/react', () => ({
  Check: (props: any) => <svg data-testid="check-icon" {...props} />,
}));

const baseTask: Task = {
  id: 't1',
  title: 'Spray rooibos field',
  description: null,
  enterprise: 'rooibos',
  field_id: 'f1',
  field_name: 'Block A',
  type: 'scheduled',
  status: 'pending',
  priority: 'high',
  due_date: new Date().toISOString().slice(0, 10),
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
  status_category: 'active',
  estimated_minutes: null,
  actual_minutes: null,
  blocked_reason: null,
  blocked_until: null,
  sort_order: 0,
  verified_by: null,
  verified_at: null,
  tags: [
    { id: 'tag1', name: 'Rooibos', color: '#d97706', group: 'enterprise' },
    { id: 'tag2', name: 'Spraying', color: '#2563eb', group: 'category' },
  ],
};

const statuses: TaskStatusConfig[] = [
  { id: 's1', farm_id: 'farm1', name: 'To Do', color: '#9ca3af', category: 'active', sort_order: 0, is_default: 1 },
  { id: 's2', farm_id: 'farm1', name: 'Done', color: '#047857', category: 'done', sort_order: 1, is_default: 0 },
];

describe('TaskRow', () => {
  it('renders the task title', () => {
    render(
      <TaskRow
        task={baseTask}
        statuses={statuses}
        onComplete={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Spray rooibos field')).toBeInTheDocument();
  });

  it('renders tag pills with colors', () => {
    render(
      <TaskRow
        task={baseTask}
        statuses={statuses}
        onComplete={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const rooibosTag = screen.getByText('Rooibos');
    expect(rooibosTag).toBeInTheDocument();
    const sprayingTag = screen.getByText('Spraying');
    expect(sprayingTag).toBeInTheDocument();
  });

  it('clicking checkbox calls onComplete', () => {
    const onComplete = vi.fn();
    render(
      <TaskRow
        task={baseTask}
        statuses={statuses}
        onComplete={onComplete}
        onSelect={vi.fn()}
      />,
    );
    const checkbox = screen.getByRole('button', { name: /complete task/i });
    fireEvent.click(checkbox);
    expect(onComplete).toHaveBeenCalledWith('t1');
  });

  it('shows priority indicator', () => {
    render(
      <TaskRow
        task={baseTask}
        statuses={statuses}
        onComplete={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const dot = screen.getByTestId('priority-dot');
    expect(dot).toBeInTheDocument();
  });

  it('completed task has strikethrough styling', () => {
    const completedTask: Task = {
      ...baseTask,
      status: 'completed',
      completed_date: new Date().toISOString(),
    };
    render(
      <TaskRow
        task={completedTask}
        statuses={statuses}
        onComplete={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const title = screen.getByText('Spray rooibos field');
    expect(title.className).toContain('line-through');
  });
});
