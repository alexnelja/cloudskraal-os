import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createTask, updateTask, getTasks } from '../../api/calendar';
import type { Task, TaskType, TaskPriority } from '../../types/calendar';
import Sheet from '../ui/Sheet';

interface TaskEditorProps {
  task?: Task;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'triggered', label: 'Triggered' },
  { value: 'dependent', label: 'Dependent' },
];

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const ENTERPRISES = [
  { value: '', label: 'None' },
  { value: 'rooibos', label: 'Rooibos' },
  { value: 'wine', label: 'Wine / Grapes' },
  { value: 'sheep', label: 'Sheep / Grazing' },
  { value: 'buchu', label: 'Buchu' },
  { value: 'general', label: 'General' },
];

interface FormState {
  title: string;
  type: TaskType;
  enterprise: string;
  priority: TaskPriority;
  due_date: string;
  description: string;
  assigned_to: string;
  notes: string;
  depends_on_task_id: string;
}

export default function TaskEditor({ task, open, onClose, onSave }: TaskEditorProps) {
  const isEdit = !!task;

  const [form, setForm] = useState<FormState>({
    title: '',
    type: 'manual',
    enterprise: '',
    priority: 'medium',
    due_date: '',
    description: '',
    assigned_to: '',
    notes: '',
    depends_on_task_id: '',
  });

  const [saving, setSaving] = useState(false);
  const [dependencySearch, setDependencySearch] = useState('');
  const [dependencyResults, setDependencyResults] = useState<Task[]>([]);
  const [showDependencyDropdown, setShowDependencyDropdown] = useState(false);
  const [selectedDependencyTitle, setSelectedDependencyTitle] = useState('');

  useEffect(() => {
    if (open) {
      if (task) {
        setForm({
          title: task.title,
          type: task.type,
          enterprise: task.enterprise ?? '',
          priority: task.priority,
          due_date: task.due_date ?? '',
          description: task.description ?? '',
          assigned_to: task.assigned_to ?? '',
          notes: task.notes ?? '',
          depends_on_task_id: task.depends_on_task_id ?? '',
        });
        setSelectedDependencyTitle(task.depends_on_task?.title ?? '');
      } else {
        setForm({
          title: '',
          type: 'manual',
          enterprise: '',
          priority: 'medium',
          due_date: '',
          description: '',
          assigned_to: '',
          notes: '',
          depends_on_task_id: '',
        });
        setSelectedDependencyTitle('');
      }
      setDependencySearch('');
      setDependencyResults([]);
    }
  }, [open, task]);

  async function searchDependency(query: string) {
    setDependencySearch(query);
    if (query.length < 2) {
      setDependencyResults([]);
      setShowDependencyDropdown(false);
      return;
    }
    try {
      const tasks = await getTasks();
      const filtered = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) &&
          t.id !== task?.id,
      );
      setDependencyResults(filtered.slice(0, 10));
      setShowDependencyDropdown(true);
    } catch (err) {
      console.error('Failed to search tasks:', err);
    }
  }

  function selectDependency(dep: Task) {
    setForm({ ...form, depends_on_task_id: dep.id });
    setSelectedDependencyTitle(dep.title);
    setDependencySearch('');
    setShowDependencyDropdown(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      title: form.title,
      type: form.type,
      enterprise: form.enterprise || null,
      priority: form.priority,
      due_date: form.due_date || null,
      description: form.description || null,
      assigned_to: form.assigned_to || null,
      notes: form.notes || null,
      depends_on_task_id: form.depends_on_task_id || null,
      status: task?.status ?? ('pending' as const),
      field_id: task?.field_id ?? null,
      recurrence_rule: task?.recurrence_rule ?? null,
      calendar_event_id: task?.calendar_event_id ?? null,
      status_id: task?.status_id ?? null,
      estimated_minutes: task?.estimated_minutes ?? null,
      actual_minutes: task?.actual_minutes ?? null,
      blocked_reason: task?.blocked_reason ?? null,
      blocked_until: task?.blocked_until ?? null,
      sort_order: task?.sort_order ?? 0,
      verified_by: task?.verified_by ?? null,
      verified_at: task?.verified_at ?? null,
    };

    try {
      if (isEdit) {
        await updateTask(task.id, payload);
      } else {
        await createTask(payload);
      }
      onSave();
    } catch (err) {
      console.error('Failed to save task:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={isEdit ? 'Edit Task' : 'New Task'} id="task-editor">

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="e.g. Apply fertilizer to Block A"
            />
          </div>

          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Enterprise + Due date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Enterprise</label>
              <select
                value={form.enterprise}
                onChange={(e) => setForm({ ...form, enterprise: e.target.value })}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {ENTERPRISES.map((ent) => (
                  <option key={ent.value} value={ent.value}>{ent.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              placeholder="Task details..."
            />
          </div>

          {/* Assigned to */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Assigned To</label>
            <input
              type="text"
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="e.g. Johan"
            />
          </div>

          {/* Depends on (only if type=dependent) */}
          {form.type === 'dependent' && (
            <div className="relative">
              <label className="block text-sm font-medium text-stone-700 mb-1">Depends On</label>
              {form.depends_on_task_id && selectedDependencyTitle ? (
                <div className="flex items-center gap-2 p-2 border border-stone-200 rounded-lg bg-stone-50">
                  <span className="text-sm text-stone-700 flex-1 truncate">{selectedDependencyTitle}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, depends_on_task_id: '' });
                      setSelectedDependencyTitle('');
                    }}
                    className="text-stone-400 hover:text-stone-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={dependencySearch}
                  onChange={(e) => searchDependency(e.target.value)}
                  onFocus={() => { if (dependencyResults.length > 0) setShowDependencyDropdown(true); }}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Search tasks..."
                />
              )}
              {showDependencyDropdown && dependencyResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {dependencyResults.map((dep) => (
                    <button
                      key={dep.id}
                      type="button"
                      onClick={() => selectDependency(dep)}
                      className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      {dep.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              placeholder="Additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#f3f4f3]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
    </Sheet>
  );
}
