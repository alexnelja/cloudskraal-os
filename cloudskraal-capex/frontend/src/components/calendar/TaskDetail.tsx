import { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  Zap,
  Link,
  Hand,
  Lock,
  Play,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  getTask,
  updateTask,
  completeTask,
  updateChecklistItem,
  addChecklistItem,
  deleteChecklistItem,
} from '../../api/calendar';
import type { Task, TaskChecklist } from '../../types/calendar';
import {
  PRIORITY_COLORS,
  STATUS_COLORS,
  TASK_TYPE_LABELS,
} from '../../types/calendar';
import { ENTERPRISE_COLORS, ENTERPRISE_LABELS } from '../../types/farm';

interface TaskDetailProps {
  taskId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onEdit?: (task: Task) => void;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  scheduled: Clock,
  triggered: Zap,
  dependent: Link,
  manual: Hand,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TaskDetail({ taskId, onClose, onRefresh, onEdit }: TaskDetailProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }
    setLoading(true);
    setError(null);
    getTask(taskId)
      .then((data) => {
        setTask(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load task:', err);
        setError('Failed to load task details.');
        setLoading(false);
      });
  }, [taskId]);

  const isOpen = taskId !== null;

  async function handleStatusChange(newStatus: 'in_progress' | 'completed') {
    if (!task) return;
    try {
      if (newStatus === 'completed') {
        const updated = await completeTask(task.id);
        setTask(updated);
      } else {
        const updated = await updateTask(task.id, { status: newStatus });
        setTask(updated);
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  }

  async function handleToggleChecklist(item: TaskChecklist) {
    try {
      const updated = await updateChecklistItem(item.id, { checked: !item.checked });
      setTask((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          checklists: prev.checklists?.map((c) =>
            c.id === updated.id ? updated : c,
          ),
        };
      });
    } catch (err) {
      console.error('Failed to toggle checklist item:', err);
    }
  }

  async function handleAddChecklistItem() {
    if (!task || !newChecklistItem.trim()) return;
    try {
      const sortOrder = (task.checklists?.length ?? 0) + 1;
      const item = await addChecklistItem(task.id, {
        item: newChecklistItem.trim(),
        checked: false,
        sort_order: sortOrder,
      });
      setTask((prev) => {
        if (!prev) return prev;
        return { ...prev, checklists: [...(prev.checklists ?? []), item] };
      });
      setNewChecklistItem('');
    } catch (err) {
      console.error('Failed to add checklist item:', err);
    }
  }

  async function handleDeleteChecklistItem(itemId: string) {
    try {
      await deleteChecklistItem(itemId);
      setTask((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          checklists: prev.checklists?.filter((c) => c.id !== itemId),
        };
      });
    } catch (err) {
      console.error('Failed to delete checklist item:', err);
    }
  }

  const dependencyBlocked =
    task?.depends_on_task && task.depends_on_task.status !== 'completed';

  const TypeIcon = task ? (TYPE_ICONS[task.type] ?? Clock) : Clock;

  return (
    <>
      {/* Desktop panel */}
      <div
        className={`
          hidden md:flex flex-col
          fixed top-0 right-0 h-full w-[420px]
          bg-white border-l border-stone-200 shadow-xl
          overflow-y-auto z-40
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <PanelContent
          task={task}
          loading={loading}
          error={error}
          TypeIcon={TypeIcon}
          dependencyBlocked={!!dependencyBlocked}
          newChecklistItem={newChecklistItem}
          onNewChecklistItemChange={setNewChecklistItem}
          onAddChecklistItem={handleAddChecklistItem}
          onToggleChecklist={handleToggleChecklist}
          onDeleteChecklistItem={handleDeleteChecklistItem}
          onStatusChange={handleStatusChange}
          onClose={onClose}
          onEdit={onEdit}
          showDragHandle={false}
        />
      </div>

      {/* Mobile bottom sheet */}
      <div
        className={`
          flex md:hidden flex-col
          fixed bottom-0 left-0 w-full max-h-[70vh]
          bg-white rounded-t-2xl shadow-xl
          overflow-y-auto z-40
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        <PanelContent
          task={task}
          loading={loading}
          error={error}
          TypeIcon={TypeIcon}
          dependencyBlocked={!!dependencyBlocked}
          newChecklistItem={newChecklistItem}
          onNewChecklistItemChange={setNewChecklistItem}
          onAddChecklistItem={handleAddChecklistItem}
          onToggleChecklist={handleToggleChecklist}
          onDeleteChecklistItem={handleDeleteChecklistItem}
          onStatusChange={handleStatusChange}
          onClose={onClose}
          onEdit={onEdit}
          showDragHandle
        />
      </div>
    </>
  );
}

interface PanelContentProps {
  task: Task | null;
  loading: boolean;
  error: string | null;
  TypeIcon: React.ElementType;
  dependencyBlocked: boolean;
  newChecklistItem: string;
  onNewChecklistItemChange: (val: string) => void;
  onAddChecklistItem: () => void;
  onToggleChecklist: (item: TaskChecklist) => void;
  onDeleteChecklistItem: (itemId: string) => void;
  onStatusChange: (status: 'in_progress' | 'completed') => void;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  showDragHandle: boolean;
}

function PanelContent({
  task,
  loading,
  error,
  TypeIcon,
  dependencyBlocked,
  newChecklistItem,
  onNewChecklistItemChange,
  onAddChecklistItem,
  onToggleChecklist,
  onDeleteChecklistItem,
  onStatusChange,
  onClose,
  onEdit,
  showDragHandle,
}: PanelContentProps) {
  return (
    <div className="flex flex-col min-h-0">
      {showDragHandle && (
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-stone-200 px-4 py-3 flex items-start justify-between gap-3 flex-shrink-0 z-10">
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="h-5 w-40 bg-stone-200 rounded animate-pulse" />
          ) : task ? (
            <>
              <h2 className="text-lg font-bold text-stone-900 truncate">{task.title}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-stone-500">
                  <TypeIcon size={12} />
                  {TASK_TYPE_LABELS[task.type]}
                </span>
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                  style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? '#9ca3af' }}
                >
                  {task.priority}
                </span>
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white capitalize"
                  style={{ backgroundColor: STATUS_COLORS[task.status] ?? '#9ca3af' }}
                >
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            </>
          ) : (
            <h2 className="text-lg font-bold text-stone-900">Task Details</h2>
          )}
        </div>
        <div className="flex items-center gap-1">
          {task && onEdit && (
            <button
              onClick={() => onEdit(task)}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              aria-label="Edit task"
            >
              <Pencil size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 bg-stone-100 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
            ))}
          </div>
        )}

        {error && (
          <div className="p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && task && (
          <>
            {/* Status actions */}
            <div className="px-4 pt-4 pb-3">
              {dependencyBlocked && task.depends_on_task && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 mb-3">
                  <Lock size={14} className="text-amber-600" />
                  <span className="text-xs text-amber-800">
                    Blocked by: {task.depends_on_task.title}
                  </span>
                </div>
              )}

              {task.status === 'completed' ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span className="text-sm text-emerald-800">
                    Completed {task.completed_date ? formatDate(task.completed_date) : ''}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {task.status === 'pending' && (
                    <button
                      onClick={() => onStatusChange('in_progress')}
                      disabled={dependencyBlocked}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play size={12} />
                      Start
                    </button>
                  )}
                  <button
                    onClick={() => onStatusChange('completed')}
                    disabled={dependencyBlocked}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 size={12} />
                    Complete
                  </button>
                </div>
              )}
            </div>

            {/* Info grid */}
            <div className="px-4 pb-3 grid grid-cols-2 gap-3">
              {task.enterprise && (
                <InfoCell
                  label="Enterprise"
                  value={ENTERPRISE_LABELS[task.enterprise] ?? task.enterprise}
                  color={ENTERPRISE_COLORS[task.enterprise] ?? undefined}
                />
              )}
              {task.field_name && (
                <InfoCell label="Field" value={task.field_name} />
              )}
              {task.due_date && (
                <InfoCell label="Due Date" value={formatDate(task.due_date)} />
              )}
              {task.assigned_to && (
                <InfoCell label="Assigned To" value={task.assigned_to} />
              )}
            </div>

            {/* Description */}
            {task.description && (
              <div className="px-4 pb-3">
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Description</h3>
                <p className="text-sm text-stone-700 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {/* Inputs table */}
            {task.inputs && task.inputs.length > 0 && (
              <div className="px-4 pb-3">
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Inputs</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="text-left py-1 pr-2 text-stone-500 font-medium">Product</th>
                        <th className="text-right py-1 px-2 text-stone-500 font-medium">Rate</th>
                        <th className="text-right py-1 px-2 text-stone-500 font-medium">Applied</th>
                        <th className="text-right py-1 pl-2 text-stone-500 font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {task.inputs.map((input) => (
                        <tr key={input.id} className="border-b border-stone-100">
                          <td className="py-1.5 pr-2 text-stone-800">{input.product_name}</td>
                          <td className="py-1.5 px-2 text-right text-stone-600">
                            {input.rate != null ? `${input.rate} ${input.rate_unit ?? ''}` : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right text-stone-600">
                            {input.total_applied != null ? `${input.total_applied} ${input.total_unit ?? ''}` : '—'}
                          </td>
                          <td className="py-1.5 pl-2 text-right text-stone-600">
                            {input.total_cost != null ? `R${input.total_cost.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Checklist */}
            <div className="px-4 pb-3">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Checklist</h3>
              {task.checklists && task.checklists.length > 0 && (
                <div className="space-y-1 mb-2">
                  {task.checklists
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((item) => (
                      <div key={item.id} className="flex items-center gap-2 group">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => onToggleChecklist(item)}
                          className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span
                          className={`text-sm flex-1 ${item.checked ? 'line-through text-stone-400' : 'text-stone-700'}`}
                        >
                          {item.item}
                        </span>
                        <button
                          onClick={() => onDeleteChecklistItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-stone-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={(e) => onNewChecklistItemChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddChecklistItem();
                    }
                  }}
                  placeholder="Add item..."
                  className="flex-1 border border-stone-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  onClick={onAddChecklistItem}
                  className="p-1.5 text-stone-400 hover:text-emerald-600 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Notes */}
            {task.notes && (
              <div className="px-4 pb-4">
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Notes</h3>
                <p className="text-sm text-stone-700 whitespace-pre-wrap">{task.notes}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InfoCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-stone-500 mb-0.5">{label}</p>
      {color ? (
        <span
          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: color }}
        >
          {value}
        </span>
      ) : (
        <p className="text-sm text-stone-800 font-medium">{value}</p>
      )}
    </div>
  );
}
