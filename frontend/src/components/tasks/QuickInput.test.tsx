import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickInput from './QuickInput';
import type { Tag } from '../../types/taskManager';

const makeTags = (...names: string[]): Tag[] =>
  names.map((name, i) => ({
    id: `tag-${i}`,
    farm_id: 'farm-1',
    name,
    color: '#aaa',
    group: 'custom' as const,
    sort_order: i,
    created_at: '2026-01-01',
  }));

const fields = [
  { id: 'f1', name: 'Block 5A' },
  { id: 'f2', name: 'Paddock North' },
];

describe('QuickInput', () => {
  it('renders input with placeholder', () => {
    render(<QuickInput tags={[]} fields={[]} onSubmit={() => {}} />);
    expect(
      screen.getByPlaceholderText(/Add a task/i),
    ).toBeInTheDocument();
  });

  it('Enter key calls onSubmit with parsed data', async () => {
    const onSubmit = vi.fn();
    const tags = makeTags('rooibos');
    render(<QuickInput tags={tags} fields={fields} onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText(/Add a task/i);
    await userEvent.type(input, 'Spray weeds p1{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const call = onSubmit.mock.calls[0][0];
    expect(call.title).toBe('Spray weeds');
    expect(call.priority).toBe('urgent');
  });

  it('shows tag autocomplete when # is typed', async () => {
    const tags = makeTags('rooibos', 'livestock');
    render(<QuickInput tags={tags} fields={fields} onSubmit={() => {}} />);

    const input = screen.getByPlaceholderText(/Add a task/i);
    await userEvent.type(input, 'Test #');

    // Autocomplete dropdown should appear with tag names
    expect(screen.getByText('rooibos')).toBeInTheDocument();
    expect(screen.getByText('livestock')).toBeInTheDocument();
  });

  it('shows parsed pills below input', async () => {
    const tags = makeTags('rooibos');
    render(<QuickInput tags={tags} fields={fields} onSubmit={() => {}} />);

    const input = screen.getByPlaceholderText(/Add a task/i);
    await userEvent.type(input, 'Spray tomorrow p1 #rooibos');

    // Should show priority pill
    expect(screen.getByText(/urgent/i)).toBeInTheDocument();
    // Should show tag pill
    expect(screen.getByText('rooibos')).toBeInTheDocument();
  });

  it('clears input after submit', async () => {
    render(<QuickInput tags={[]} fields={[]} onSubmit={() => {}} />);
    const input = screen.getByPlaceholderText(/Add a task/i) as HTMLInputElement;
    await userEvent.type(input, 'Test task{Enter}');
    expect(input.value).toBe('');
  });
});
