/**
 * Spec 3.2 — CreateTaskModal template pre-fill: title, cost preview tile,
 * and template_id + suggested assignee on the save payload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateTaskModal from './CreateTaskModal';
import type { TaskSuggestion } from '../../api/taskSuggestions';

const template: TaskSuggestion = {
  template_id: 'tpl-roo-spray',
  op_type: 'spray',
  name: 'Onkruidspuit',
  notes: null,
  default_duration_hrs: 4,
  inputs: [{ product: 'Glifosaat', rate_per_ha: 2, unit: 'l', quantity: 40, cost: 4000 }],
  estimated_cost_zar: 4000,
  cost_warnings: [],
  suggested_assignee: 'Willem',
};

function renderModal(overrides: Partial<React.ComponentProps<typeof CreateTaskModal>> = {}) {
  const props = {
    open: true,
    defaultTitle: '',
    context: { kind: 'field' as const, label: 'Kamp 1', fieldId: 'f1' },
    template,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { ...props, ...render(<CreateTaskModal {...props} />) };
}

describe('CreateTaskModal — template pre-fill (3.2)', () => {
  beforeEach(cleanup);

  it('pre-fills the title and shows the cost preview tile', () => {
    renderModal();
    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Onkruidspuit');
    const tile = screen.getByTestId('template-cost-preview');
    expect(tile).toHaveTextContent('spray');
    expect(tile.textContent!.replace(/[\s  ]/g, '')).toContain('R4000');
    expect(tile).toHaveTextContent('Glifosaat');
    expect(tile).toHaveTextContent('last done by Willem');
  });

  it('save payload carries template_id + suggested assignee + field_id', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Onkruidspuit',
      field_id: 'f1',
      template_id: 'tpl-roo-spray',
      assigned_to: 'Willem',
    }));
  });

  it('without a template the modal behaves as before (no tile, no template_id)', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({ template: null, defaultTitle: 'Plain task' });
    expect(screen.queryByTestId('template-cost-preview')).toBeNull();
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(expect.not.objectContaining({ template_id: expect.anything() }));
  });
});
