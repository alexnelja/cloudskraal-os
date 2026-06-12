/**
 * Spec 4.1b — TaskLifecycleCard: state stepper + transition actions.
 * Start / Complete-with-actuals / Verify-with-workers / Cancel-with-reason,
 * driving POST /tasks/:id/transition via api/calendar.transitionTask.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { Task } from '../../types/calendar';

const mockTransitionTask = vi.fn();
const mockGetTaskEvents = vi.fn();
vi.mock('../../api/calendar', () => ({
  transitionTask: (...a: unknown[]) => mockTransitionTask(...a),
  getTaskEvents: (...a: unknown[]) => mockGetTaskEvents(...a),
}));
vi.mock('../../api/employees', () => ({
  getEmployees: vi.fn(() => Promise.resolve([
    { id: 'emp1', name: 'Willem' },
    { id: 'emp2', name: 'Sarah' },
  ])),
}));

import TaskLifecycleCard from './TaskLifecycleCard';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1', title: 'Teesny', status: 'pending', priority: 'medium',
    enterprise: null, field_id: 'f1', type: 'manual', due_date: null,
    completed_date: null, completed_by: null, assigned_to: null,
    notes: null, description: null,
    ...overrides,
  } as Task;
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  mockTransitionTask.mockResolvedValue({ task: {}, warnings: [] });
  mockGetTaskEvents.mockResolvedValue([]);
});

describe('TaskLifecycleCard', () => {
  it('scheduled task shows Start; clicking transitions to in_progress', async () => {
    const onTransitioned = vi.fn();
    render(<TaskLifecycleCard task={makeTask()} onTransitioned={onTransitioned} />);
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    await waitFor(() => expect(mockTransitionTask).toHaveBeenCalledWith('t1',
      expect.objectContaining({ to_state: 'in_progress' })));
    await waitFor(() => expect(onTransitioned).toHaveBeenCalled());
  });

  it('in_progress task completes with captured actuals', async () => {
    render(<TaskLifecycleCard task={makeTask({ state: 'in_progress' })} onTransitioned={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /complete/i }));
    fireEvent.change(screen.getByLabelText(/hours worked/i), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(/area covered/i), { target: { value: '4.5' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm complete/i }));
    await waitFor(() => expect(mockTransitionTask).toHaveBeenCalledWith('t1',
      expect.objectContaining({
        to_state: 'completed', actual_duration_hrs: 6, actual_area_ha: 4.5,
      })));
  });

  it('completed task verifies with workers (posts actuals to COP)', async () => {
    render(<TaskLifecycleCard task={makeTask({ state: 'completed' })} onTransitioned={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^verify/i }));
    // employees load into the worker row
    const select = await screen.findByLabelText(/worker 1/i);
    fireEvent.change(select, { target: { value: 'emp1' } });
    fireEvent.change(screen.getByLabelText(/hours 1/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm verify/i }));
    await waitFor(() => expect(mockTransitionTask).toHaveBeenCalledWith('t1',
      expect.objectContaining({
        to_state: 'verified',
        workers: [{ employee_id: 'emp1', hours: 5 }],
      })));
  });

  it('verified task shows the posted state and no action buttons', () => {
    render(<TaskLifecycleCard
      task={makeTask({ state: 'verified', verified_at: '2026-06-11T10:00:00Z', verified_by: 'Alex' })}
      onTransitioned={vi.fn()} />);
    expect(screen.getByText(/actuals posted to COP/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start|complete|verify|cancel/i })).toBeNull();
  });

  it('cancel requires a reason before confirming', async () => {
    render(<TaskLifecycleCard task={makeTask()} onTransitioned={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel task/i }));
    const confirm = screen.getByRole('button', { name: /confirm cancel/i });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'rain' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(mockTransitionTask).toHaveBeenCalledWith('t1',
      expect.objectContaining({ to_state: 'cancelled', reason: 'rain' })));
  });

  it('legacy completed status (no state) is treated as completed', () => {
    render(<TaskLifecycleCard task={makeTask({ status: 'completed' })} onTransitioned={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^verify/i })).toBeInTheDocument();
  });

  it('surfaces transition errors instead of silently failing', async () => {
    mockTransitionTask.mockRejectedValue(new Error('API error 409: {"error":"already_verified"}'));
    render(<TaskLifecycleCard task={makeTask({ state: 'completed' })} onTransitioned={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^verify/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirm verify/i }));
    await waitFor(() => expect(screen.getByText(/already_verified|409/)).toBeInTheDocument());
  });
});
