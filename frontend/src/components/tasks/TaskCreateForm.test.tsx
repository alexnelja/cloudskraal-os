import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TaskCreateForm from './TaskCreateForm';
import type { Tag, TaskStatusConfig } from '../../types/taskManager';

vi.mock('../map/FluidDialog', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
}));

const tags: Tag[] = [
  { id: 'tag1', farm_id: 'f1', name: 'Rooibos', color: '#d97706', group: 'enterprise', sort_order: 0, created_at: '' },
  { id: 'tag2', farm_id: 'f1', name: 'Spraying', color: '#2563eb', group: 'category', sort_order: 1, created_at: '' },
];

const statuses: TaskStatusConfig[] = [
  { id: 's1', farm_id: 'f1', name: 'To Do', color: '#9ca3af', category: 'active', sort_order: 0, is_default: 1 },
  { id: 's2', farm_id: 'f1', name: 'Done', color: '#047857', category: 'done', sort_order: 1, is_default: 0 },
];

const fields = [
  { id: 'field1', name: 'Block A' },
  { id: 'field2', name: 'Block B' },
];

describe('TaskCreateForm', () => {
  it('renders nothing when open=false', () => {
    render(
      <TaskCreateForm
        open={false}
        tags={tags}
        statuses={statuses}
        fields={fields}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders title input and save button when open', () => {
    render(
      <TaskCreateForm
        open={true}
        tags={tags}
        statuses={statuses}
        fields={fields}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('Task title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('save button disabled when title is empty', () => {
    render(
      <TaskCreateForm
        open={true}
        tags={tags}
        statuses={statuses}
        fields={fields}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeDisabled();
  });

  it('save button enabled when title has text', () => {
    render(
      <TaskCreateForm
        open={true}
        tags={tags}
        statuses={statuses}
        fields={fields}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Task title'), {
      target: { value: 'New task' },
    });
    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).not.toBeDisabled();
  });

  it('renders priority pills (Low, Medium, High, Urgent)', () => {
    render(
      <TaskCreateForm
        open={true}
        tags={tags}
        statuses={statuses}
        fields={fields}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('renders tag pills from props', () => {
    render(
      <TaskCreateForm
        open={true}
        tags={tags}
        statuses={statuses}
        fields={fields}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Rooibos')).toBeInTheDocument();
    expect(screen.getByText('Spraying')).toBeInTheDocument();
  });

  it('clicking a tag pill toggles its selection', () => {
    render(
      <TaskCreateForm
        open={true}
        tags={tags}
        statuses={statuses}
        fields={fields}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const rooibosBtn = screen.getByText('Rooibos');
    // Initially unselected — should have outline style (no filled background)
    expect(rooibosBtn.className).not.toContain('text-white');
    fireEvent.click(rooibosBtn);
    // After click — selected, filled background
    expect(rooibosBtn.className).toContain('text-white');
    fireEvent.click(rooibosBtn);
    // After second click — deselected again
    expect(rooibosBtn.className).not.toContain('text-white');
  });

  it('calls onSave with form data including selected tag IDs', () => {
    const onSave = vi.fn();
    render(
      <TaskCreateForm
        open={true}
        tags={tags}
        statuses={statuses}
        fields={fields}
        onSave={onSave}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Task title'), {
      target: { value: 'Spray field' },
    });
    // Select a tag
    fireEvent.click(screen.getByText('Rooibos'));
    // Submit
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const data = onSave.mock.calls[0][0];
    expect(data.title).toBe('Spray field');
    expect(data.tag_ids).toContain('tag1');
    expect(data.status_id).toBe('s1'); // default status
    expect(data.priority).toBe('medium'); // default priority
  });
});
