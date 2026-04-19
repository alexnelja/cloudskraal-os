import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TaskStats from './TaskStats';
import type { Task } from '../../types/calendar';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, style, ...props }: any) => (
      <div style={style} {...props}>{children}</div>
    ),
  },
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    title: 'Test task',
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
    status_id: null,
    estimated_minutes: null,
    actual_minutes: null,
    blocked_reason: null,
    blocked_until: null,
    sort_order: 0,
    verified_by: null,
    verified_at: null,
    ...overrides,
  };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('TaskStats', () => {
  it('is collapsed by default (stats not visible)', () => {
    const tasks = [makeTask({ status: 'completed', completed_date: todayStr(), due_date: todayStr() })];
    render(<TaskStats tasks={tasks} completedToday={1} totalToday={1} />);

    expect(screen.getByTestId('stats-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('stats-panel')).not.toBeInTheDocument();
  });

  it('expands when toggle is clicked', () => {
    const tasks = [makeTask({ status: 'completed', completed_date: todayStr(), due_date: todayStr() })];
    render(<TaskStats tasks={tasks} completedToday={1} totalToday={1} />);

    fireEvent.click(screen.getByTestId('stats-toggle'));
    expect(screen.getByTestId('stats-panel')).toBeInTheDocument();
  });

  it('shows completion rate', () => {
    const today = todayStr();
    const tasks = [
      makeTask({ status: 'completed', completed_date: today, due_date: today }),
      makeTask({ status: 'completed', completed_date: today, due_date: today }),
      makeTask({ status: 'pending', due_date: today }),
    ];
    render(<TaskStats tasks={tasks} completedToday={2} totalToday={3} />);

    fireEvent.click(screen.getByTestId('stats-toggle'));
    expect(screen.getByTestId('completion-rate')).toHaveTextContent('67%');
  });

  it('shows average tasks per day', () => {
    const today = todayStr();
    const tasks = [
      makeTask({ status: 'completed', completed_date: today, due_date: today }),
      makeTask({ status: 'completed', completed_date: today, due_date: today }),
    ];
    render(<TaskStats tasks={tasks} completedToday={2} totalToday={2} />);

    fireEvent.click(screen.getByTestId('stats-toggle'));
    // 2 tasks / 7 days = 0.3
    expect(screen.getByTestId('avg-per-day')).toHaveTextContent('0.3');
  });

  it('shows streak count', () => {
    const today = todayStr();
    const tasks = [
      makeTask({ status: 'completed', completed_date: today }),
    ];
    render(<TaskStats tasks={tasks} completedToday={1} totalToday={1} />);

    fireEvent.click(screen.getByTestId('stats-toggle'));
    expect(screen.getByTestId('streak')).toHaveTextContent('1');
  });
});
