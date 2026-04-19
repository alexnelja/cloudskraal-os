import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BoardView from './BoardView';
import type { Task } from '../../types/calendar';
import type { TaskStatusConfig } from '../../types/taskManager';

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  DragOverlay: ({ children }: any) => children ?? null,
  closestCorners: vi.fn(),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  verticalListSortingStrategy: {},
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

const statuses: TaskStatusConfig[] = [
  { id: 's1', farm_id: 'farm1', name: 'To Do', color: '#9ca3af', category: 'active', sort_order: 0, is_default: 1 },
  { id: 's2', farm_id: 'farm1', name: 'In Progress', color: '#2563eb', category: 'active', sort_order: 1, is_default: 0 },
  { id: 's3', farm_id: 'farm1', name: 'Done', color: '#047857', category: 'done', sort_order: 2, is_default: 0 },
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

describe('BoardView', () => {
  it('renders one column per status', () => {
    render(
      <BoardView
        tasks={[]}
        statuses={statuses}
        onStatusChange={vi.fn()}
        onSelectTask={vi.fn()}
      />,
    );
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders task cards in correct columns', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Task A', status_id: 's1' }),
      makeTask({ id: 't2', title: 'Task B', status_id: 's2' }),
    ];
    render(
      <BoardView
        tasks={tasks}
        statuses={statuses}
        onStatusChange={vi.fn()}
        onSelectTask={vi.fn()}
      />,
    );
    expect(screen.getByText('Task A')).toBeInTheDocument();
    expect(screen.getByText('Task B')).toBeInTheDocument();
  });

  it('shows column task counts', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Task A', status_id: 's1' }),
      makeTask({ id: 't2', title: 'Task B', status_id: 's1' }),
    ];
    render(
      <BoardView
        tasks={tasks}
        statuses={statuses}
        onStatusChange={vi.fn()}
        onSelectTask={vi.fn()}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('empty column shows "No tasks"', () => {
    render(
      <BoardView
        tasks={[]}
        statuses={[statuses[0]]}
        onStatusChange={vi.fn()}
        onSelectTask={vi.fn()}
      />,
    );
    expect(screen.getByText('No tasks')).toBeInTheDocument();
  });
});
