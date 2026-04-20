import { describe, it, expect } from 'vitest';
import { checkTransitionTriggers, checkPhiWarnings } from './usagePeriodTriggers';
import type { Task } from '../types/calendar';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Generic task',
    description: null,
    enterprise: null,
    field_id: null,
    type: 'manual',
    status: 'pending',
    priority: 'medium',
    due_date: '2026-04-17',
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
    tags: [],
    ...overrides,
  };
}

describe('checkTransitionTriggers', () => {
  const today = new Date();
  const recentDate = new Date(today);
  recentDate.setDate(recentDate.getDate() - 5);
  const recentISO = recentDate.toISOString().slice(0, 10);

  const oldDate = new Date(today);
  oldDate.setDate(oldDate.getDate() - 60);
  const oldISO = oldDate.toISOString().slice(0, 10);

  it('returns empty when all fields have recent tasks', () => {
    const fields = [
      { id: 'f1', name: 'Block 5A', enterprise: 'oats' },
    ];
    const tasks = [
      makeTask({ id: 't1', field_id: 'f1', due_date: recentISO }),
    ];
    const result = checkTransitionTriggers(fields, tasks);
    expect(result).toEqual([]);
  });

  it('returns suggestion for field with no tasks', () => {
    const fields = [
      { id: 'f1', name: 'Block 5A', enterprise: 'oats' },
    ];
    const tasks: Task[] = [];
    const result = checkTransitionTriggers(fields, tasks);
    expect(result).toHaveLength(1);
    expect(result[0].fieldId).toBe('f1');
    expect(result[0].fieldName).toBe('Block 5A');
    expect(result[0].toUsage).toBe('oats');
    expect(result[0].message).toContain('oats');
    expect(result[0].message).toContain('Block 5A');
  });

  it('returns suggestion for field with only old tasks', () => {
    const fields = [
      { id: 'f1', name: 'Block 3', enterprise: 'rooibos' },
    ];
    const tasks = [
      makeTask({ id: 't1', field_id: 'f1', due_date: oldISO }),
    ];
    const result = checkTransitionTriggers(fields, tasks);
    expect(result).toHaveLength(1);
    expect(result[0].toUsage).toBe('rooibos');
  });

  it('returns multiple suggestions for multiple idle fields', () => {
    const fields = [
      { id: 'f1', name: 'Block A', enterprise: 'oats' },
      { id: 'f2', name: 'Block B', enterprise: 'lupines_fourrages' },
    ];
    const tasks: Task[] = [];
    const result = checkTransitionTriggers(fields, tasks);
    expect(result).toHaveLength(2);
  });

  it('does not suggest for fields with recent tasks', () => {
    const fields = [
      { id: 'f1', name: 'Block A', enterprise: 'oats' },
      { id: 'f2', name: 'Block B', enterprise: 'rooibos' },
    ];
    const tasks = [
      makeTask({ id: 't1', field_id: 'f1', due_date: recentISO }),
      makeTask({ id: 't2', field_id: 'f2', due_date: oldISO }),
    ];
    const result = checkTransitionTriggers(fields, tasks);
    expect(result).toHaveLength(1);
    expect(result[0].fieldId).toBe('f2');
  });
});

describe('checkPhiWarnings', () => {
  it('warns when harvest within withholding period', () => {
    const warnings = checkPhiWarnings(
      'f1',
      'Block 5A',
      [{ product_name: 'Delegate', date: '2026-04-01' }],
      '2026-05-01',
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].chemical).toBe('delegate');
    expect(warnings[0].phiDays).toBe(60);
    expect(warnings[0].clearsDate).toBe('2026-05-31');
    expect(warnings[0].message).toContain('Delegate');
  });

  it('no warning when harvest after withholding period', () => {
    const warnings = checkPhiWarnings(
      'f1',
      'Block 5A',
      [{ product_name: 'Mancozeb', date: '2026-03-01' }],
      '2026-04-15',
    );
    expect(warnings).toHaveLength(0);
  });

  it('handles unknown chemicals gracefully (no warning)', () => {
    const warnings = checkPhiWarnings(
      'f1',
      'Block 5A',
      [{ product_name: 'MagicSpray 3000', date: '2026-04-01' }],
      '2026-04-10',
    );
    expect(warnings).toHaveLength(0);
  });

  it('handles multiple inputs with mixed results', () => {
    const warnings = checkPhiWarnings(
      'f1',
      'Block 5A',
      [
        { product_name: 'Chlorpyrifos', date: '2026-04-10' },
        { product_name: 'Copper Oxychloride', date: '2026-04-10' },
      ],
      '2026-04-20',
    );
    // Chlorpyrifos: 21 days from Apr 10 = May 1, harvest Apr 20 => warning
    // Copper oxychloride: 7 days from Apr 10 = Apr 17, harvest Apr 20 => no warning
    expect(warnings).toHaveLength(1);
    expect(warnings[0].chemical).toBe('chlorpyrifos');
  });

  it('handles inputs without dates (skips them)', () => {
    const warnings = checkPhiWarnings(
      'f1',
      'Block 5A',
      [{ product_name: 'Delegate' }],
      '2026-05-01',
    );
    expect(warnings).toHaveLength(0);
  });
});
