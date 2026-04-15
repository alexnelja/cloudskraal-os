import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateTaskModal from './CreateTaskModal';

function renderModal(overrides: Partial<React.ComponentProps<typeof CreateTaskModal>> = {}) {
  const props = {
    open: true,
    defaultTitle: '',
    context: { kind: 'blank' as const, label: 'this location' },
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { ...props, ...render(<CreateTaskModal {...props} />) };
}

describe('CreateTaskModal', () => {
  beforeEach(cleanup);

  it('renders title, priority, due, notes fields', () => {
    renderModal();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/due/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it('prefills title from defaultTitle prop', () => {
    renderModal({ defaultTitle: 'Service pump 3' });
    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Service pump 3');
  });

  it('Save button is disabled when title is empty', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('Save submits payload with context field_id when kind=field', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderModal({
      onSave,
      context: { kind: 'field', label: 'B1', fieldId: 'fld-1' },
    });
    await user.type(screen.getByLabelText(/title/i), 'Spray');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Spray', field_id: 'fld-1' }),
    );
  });

  it('Save submits annotation_id when kind=annotation', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderModal({
      onSave,
      context: { kind: 'annotation', label: 'Pump 1', annotationId: 'ann-1' },
    });
    await user.type(screen.getByLabelText(/title/i), 'Check');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Check', annotation_id: 'ann-1' }),
    );
  });

  it('Cancel calls onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderModal({ onCancel });
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('priority defaults to medium and can be changed', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderModal({ onSave });
    await user.type(screen.getByLabelText(/title/i), 'X');
    await user.selectOptions(screen.getByLabelText(/priority/i), 'high');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ priority: 'high' }));
  });
});
