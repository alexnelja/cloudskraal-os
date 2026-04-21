import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TagManager from './TagManager';
import type { Tag, TaskStatusConfig } from '../../types/taskManager';

vi.mock('../map/FluidDialog', () => ({
  default: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog">{children}</div> : null),
}));

const mockCreateTag = vi.fn().mockResolvedValue({
  id: 'new',
  name: 'New Tag',
  color: '#000',
  group: 'custom',
  sort_order: 0,
  created_at: '',
  farm_id: '',
});
const mockUpdateTag = vi.fn().mockResolvedValue({});
const mockDeleteTag = vi.fn().mockResolvedValue(undefined);
const mockCreateStatus = vi.fn().mockResolvedValue({
  id: 'new',
  name: 'New Status',
  color: '#000',
  category: 'active',
  sort_order: 0,
  is_default: 0,
  farm_id: '',
});
const mockUpdateStatus = vi.fn().mockResolvedValue({});
const mockDeleteStatus = vi.fn().mockResolvedValue(undefined);

vi.mock('../../api/taskManager', () => ({
  createTag: (...args: any[]) => mockCreateTag(...args),
  updateTag: (...args: any[]) => mockUpdateTag(...args),
  deleteTag: (...args: any[]) => mockDeleteTag(...args),
  createStatus: (...args: any[]) => mockCreateStatus(...args),
  updateStatus: (...args: any[]) => mockUpdateStatus(...args),
  deleteStatus: (...args: any[]) => mockDeleteStatus(...args),
}));

const sampleTags: Tag[] = [
  {
    id: 't1',
    farm_id: 'f1',
    name: 'Rooibos',
    color: '#b45309',
    group: 'enterprise',
    sort_order: 0,
    created_at: '',
  },
  {
    id: 't2',
    farm_id: 'f1',
    name: 'Urgent',
    color: '#dc2626',
    group: 'custom',
    sort_order: 1,
    created_at: '',
  },
];

const sampleStatuses: TaskStatusConfig[] = [
  {
    id: 's1',
    farm_id: 'f1',
    name: 'To Do',
    color: '#9ca3af',
    category: 'active',
    sort_order: 0,
    is_default: 1,
  },
  {
    id: 's2',
    farm_id: 'f1',
    name: 'Done',
    color: '#047857',
    category: 'done',
    sort_order: 1,
    is_default: 0,
  },
];

const onDismiss = vi.fn();
const onTagsChanged = vi.fn();

function renderOpen() {
  return render(
    <TagManager
      open={true}
      onDismiss={onDismiss}
      tags={sampleTags}
      statuses={sampleStatuses}
      onTagsChanged={onTagsChanged}
    />,
  );
}

describe('TagManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tag list when open', () => {
    renderOpen();
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Rooibos')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <TagManager
        open={false}
        onDismiss={onDismiss}
        tags={sampleTags}
        statuses={sampleStatuses}
        onTagsChanged={onTagsChanged}
      />,
    );
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('shows add tag form', () => {
    renderOpen();
    expect(
      screen.getByPlaceholderText('Tag name'),
    ).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('clicking Add calls createTag', async () => {
    renderOpen();
    const input = screen.getByPlaceholderText('Tag name');
    fireEvent.change(input, { target: { value: 'New Tag' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalledWith({
        name: 'New Tag',
        color: '#d97706',
        group: 'custom',
      });
    });
    expect(onTagsChanged).toHaveBeenCalled();
  });

  it('shows statuses tab when clicked', () => {
    renderOpen();
    fireEvent.click(screen.getByText('Statuses'));
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getAllByText('Done').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText('Status name')).toBeInTheDocument();
  });

  it('delete button opens ConfirmDialog and calls deleteTag on confirm', async () => {
    renderOpen();
    const deleteButtons = screen.getAllByLabelText('Delete tag');
    fireEvent.click(deleteButtons[0]);

    // ConfirmDialog should open with the destructive copy — click "Delete" to confirm.
    const confirmButton = await screen.findByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteTag).toHaveBeenCalledWith('t1');
    });
    expect(onTagsChanged).toHaveBeenCalled();
  });
});
