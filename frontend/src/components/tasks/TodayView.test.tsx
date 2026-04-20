import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Ensure localStorage is available in test env
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      get length() { return Object.keys(store).length; },
      key: (i: number) => Object.keys(store)[i] ?? null,
    },
    writable: true,
  });
}

import TodayView from './TodayView';
import type { Task } from '../../types/calendar';
import type { Tag, TaskStatusConfig } from '../../types/taskManager';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    li: ({ children, ...props }: any) => <li {...props}>{children}</li>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('@phosphor-icons/react', () => ({
  Check: (props: any) => <svg data-testid="check-icon" {...props} />,
  SunHorizon: (props: any) => <svg data-testid="sun-icon" {...props} />,
  Cloud: (props: any) => <svg data-testid="cloud-icon" {...props} />,
  Funnel: (props: any) => <svg data-testid="funnel-icon" {...props} />,
  MapTrifold: (props: any) => <svg data-testid="map-icon" {...props} />,
  Crosshair: (props: any) => <svg data-testid="crosshair-icon" {...props} />,
  CaretDown: (props: any) => <svg data-testid="caret-icon" {...props} />,
  CalendarBlank: (props: any) => <svg data-testid="calendar-icon" {...props} />,
  Tag: (props: any) => <svg data-testid="tag-icon" {...props} />,
  Flag: (props: any) => <svg data-testid="flag-icon" {...props} />,
  MapPin: (props: any) => <svg data-testid="mappin-icon" {...props} />,
  X: (props: any) => <svg data-testid="x-icon" {...props} />,
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: vi.fn(),
}));
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  verticalListSortingStrategy: {},
  arrayMove: vi.fn(),
  useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, transition: null, isDragging: false }),
}));
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
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
  beforeEach(() => {
    // Mock localStorage for GPS hint
    const store: Record<string, string> = { 'capex.gps-hint-shown': '1' };
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      length: 0,
      key: () => null,
    });
  });

  it('renders task list grouped by date', () => {
    const tasks = [
      makeTask({ id: 'overdue1', title: 'Overdue task', due_date: yesterday }),
      makeTask({ id: 'today1', title: 'Today task', due_date: today }),
      makeTask({ id: 'tomorrow1', title: 'Tomorrow task', due_date: tomorrow }),
    ];
    render(
      <MemoryRouter>
        <TodayView
          tasks={tasks}
          statuses={statuses}
          tags={tags}
          onComplete={vi.fn()}
          onSelectTask={vi.fn()}
          selectedTaskId={null}
        />
      </MemoryRouter>,
    );
    // Group headers are now uppercase
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getAllByText('Today').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Tomorrow').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Overdue task')).toBeInTheDocument();
    expect(screen.getByText('Today task')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow task')).toBeInTheDocument();
  });

  it('shows empty state when no tasks', () => {
    render(
      <MemoryRouter>
        <TodayView
          tasks={[]}
          statuses={statuses}
          tags={tags}
          onComplete={vi.fn()}
          onSelectTask={vi.fn()}
          selectedTaskId={null}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/all clear for today/i)).toBeInTheDocument();
  });

  it('tag filter works via filter popover', () => {
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
      <MemoryRouter>
        <TodayView
          tasks={tasks}
          statuses={statuses}
          tags={tags}
          onComplete={vi.fn()}
          onSelectTask={vi.fn()}
          selectedTaskId={null}
        />
      </MemoryRouter>,
    );
    // Both visible initially
    expect(screen.getByText('Rooibos task')).toBeInTheDocument();
    expect(screen.getByText('Spraying task')).toBeInTheDocument();

    // Open filter popover and click "Rooibos" tag
    const filterBtn = screen.getByTestId('funnel-icon').closest('button');
    if (filterBtn) fireEvent.click(filterBtn);

    // The tag buttons in the filter popover
    const rooibosPill = screen.getByRole('button', { name: /rooibos/i });
    fireEvent.click(rooibosPill);

    // Only rooibos task visible
    expect(screen.getByText('Rooibos task')).toBeInTheDocument();
    expect(screen.queryByText('Spraying task')).not.toBeInTheDocument();
  });

  it('shows inline add button when onQuickCreate provided', () => {
    render(
      <MemoryRouter>
        <TodayView
          tasks={[makeTask({ id: 't1', title: 'Task A', due_date: today })]}
          statuses={statuses}
          tags={tags}
          onComplete={vi.fn()}
          onSelectTask={vi.fn()}
          selectedTaskId={null}
          onQuickCreate={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('New Task')).toBeInTheDocument();
  });
});
