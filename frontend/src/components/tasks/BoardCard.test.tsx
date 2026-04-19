import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BoardCard from './BoardCard';
import type { Task } from '../../types/calendar';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Check irrigation pump',
  description: null,
  enterprise: null,
  field_id: null,
  type: 'manual',
  status: 'pending',
  priority: 'high',
  due_date: '2026-04-18',
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
  tags: [
    { id: 'tag1', name: 'Rooibos', color: '#d97706', group: 'enterprise' },
    { id: 'tag2', name: 'Irrigation', color: '#2563eb', group: 'category' },
  ],
  ...overrides,
});

describe('BoardCard', () => {
  it('renders task title', () => {
    render(<BoardCard task={makeTask()} onSelect={vi.fn()} />);
    expect(screen.getByText('Check irrigation pump')).toBeInTheDocument();
  });

  it('shows priority dot', () => {
    render(<BoardCard task={makeTask()} onSelect={vi.fn()} />);
    expect(screen.getByTestId('priority-dot')).toBeInTheDocument();
  });

  it('shows tag pills (max 3 + overflow)', () => {
    const tags = [
      { id: 't1', name: 'Rooibos', color: '#d97706', group: 'enterprise' as const },
      { id: 't2', name: 'Irrigation', color: '#2563eb', group: 'category' as const },
      { id: 't3', name: 'Urgent', color: '#dc2626', group: 'custom' as const },
      { id: 't4', name: 'Maintenance', color: '#047857', group: 'custom' as const },
    ];
    render(<BoardCard task={makeTask({ tags })} onSelect={vi.fn()} />);
    expect(screen.getByText('Rooibos')).toBeInTheDocument();
    expect(screen.getByText('Irrigation')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument();
  });

  it('shows due date', () => {
    render(<BoardCard task={makeTask()} onSelect={vi.fn()} />);
    expect(screen.getByText(/18 Apr/)).toBeInTheDocument();
  });
});
