import { useState, useEffect, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Trash } from '@phosphor-icons/react';
import type { Task, TaskPriority } from '../../types/calendar';
import type { Tag, TaskStatusConfig } from '../../types/taskManager';

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onDismiss: () => void;
  onSave: (taskId: string, data: Record<string, any>) => void;
  onDelete: (taskId: string) => void;
  tags: Tag[];
  statuses: TaskStatusConfig[];
  fields: Array<{ id: string; name: string }>;
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const INPUT = 'w-full bg-white border border-stone-200/80 rounded-xl px-3 py-2.5 text-[15px] text-stone-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20';
const LABEL = 'text-[13px] font-medium text-stone-500 mb-1.5 block';

export default function TaskDetailSheet({
  task,
  open,
  onDismiss,
  onSave,
  onDelete,
  tags,
  statuses,
  fields,
}: TaskDetailSheetProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [statusId, setStatusId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes || task.description || '');
      setPriority(task.priority);
      setStatusId(task.status_id);
      setDueDate(task.due_date || '');
      setAssignedTo(task.assigned_to || '');
      setEstimatedMinutes(task.estimated_minutes?.toString() || '');
      setFieldId(task.field_id);
      setSelectedTagIds(new Set(task.tags?.map((t) => t.id) || []));
      setConfirmDelete(false);
    }
  }, [task]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  const handleSave = useCallback(() => {
    if (!task) return;
    onSave(task.id, {
      title: title.trim(),
      notes: notes.trim() || null,
      description: notes.trim() || null,
      priority,
      status_id: statusId,
      due_date: dueDate || null,
      assigned_to: assignedTo.trim() || null,
      estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      field_id: fieldId,
    });
    onDismiss();
  }, [task, title, notes, priority, statusId, dueDate, assignedTo, estimatedMinutes, fieldId, onSave, onDismiss]);

  const handleDelete = useCallback(() => {
    if (!task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(task.id);
    onDismiss();
  }, [task, confirmDelete, onDelete, onDismiss]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  return (
    <AnimatePresence>
      {open && task && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
            onClick={onDismiss}
          />

          {/* Sheet */}
          <motion.aside
            className="fixed top-0 right-0 h-full w-full max-w-[24rem] z-50 bg-[#f2f2f7] shadow-2xl flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36, mass: 0.9 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-[17px] font-semibold text-stone-900">Details</h2>
              <button
                type="button"
                onClick={onDismiss}
                className="w-8 h-8 rounded-full bg-stone-200/60 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
              {/* Title */}
              <div className="bg-white rounded-2xl p-4">
                <label className={LABEL}>Title</label>
                <input
                  type="text"
                  className={INPUT}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="bg-white rounded-2xl p-4">
                <label className={LABEL}>Notes</label>
                <textarea
                  className={`${INPUT} min-h-[80px] resize-y`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes..."
                />
              </div>

              {/* Status & Priority */}
              <div className="bg-white rounded-2xl p-4 space-y-4">
                {/* Status */}
                <div>
                  <label className={LABEL}>Status</label>
                  <select
                    className={INPUT}
                    value={statusId ?? ''}
                    onChange={(e) => setStatusId(e.target.value || null)}
                  >
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className={LABEL}>Priority</label>
                  <div className="flex gap-2">
                    {PRIORITIES.map((p) => {
                      const isSelected = priority === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setPriority(p.value)}
                          className={`px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors flex-1 ${
                            isSelected
                              ? 'bg-stone-900 text-white'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="bg-white rounded-2xl p-4">
                  <label className={LABEL}>Tags</label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => {
                      const isSelected = selectedTagIds.has(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors ${
                            isSelected ? 'text-white' : 'text-stone-600'
                          }`}
                          style={
                            isSelected
                              ? { backgroundColor: tag.color }
                              : { backgroundColor: tag.color + '18', color: tag.color }
                          }
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Field, Date, Assignee, Est. minutes */}
              <div className="bg-white rounded-2xl p-4 space-y-4">
                <div>
                  <label className={LABEL}>Field</label>
                  <select
                    className={INPUT}
                    value={fieldId ?? ''}
                    onChange={(e) => setFieldId(e.target.value || null)}
                  >
                    <option value="">(no field)</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={LABEL}>Due date</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className={LABEL}>Assignee</label>
                  <input
                    type="text"
                    className={INPUT}
                    placeholder="Who?"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                  />
                </div>

                <div>
                  <label className={LABEL}>Estimated minutes</label>
                  <input
                    type="number"
                    className={`${INPUT} max-w-[120px]`}
                    min={0}
                    placeholder="0"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                  />
                </div>
              </div>

              {/* Checklist items (read-only display) */}
              {task.checklists && task.checklists.length > 0 && (
                <div className="bg-white rounded-2xl p-4">
                  <label className={LABEL}>Checklist</label>
                  <ul className="space-y-1.5">
                    {task.checklists.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-[14px]">
                        <span className={`w-4 h-4 rounded border ${item.checked ? 'bg-green-500 border-green-500' : 'border-stone-300'} flex items-center justify-center`}>
                          {item.checked && <span className="text-white text-[10px]">&#10003;</span>}
                        </span>
                        <span className={item.checked ? 'line-through text-stone-400' : 'text-stone-800'}>
                          {item.item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-stone-200/60 px-5 py-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                  confirmDelete
                    ? 'bg-red-500 text-white'
                    : 'text-red-500 hover:bg-red-50'
                }`}
              >
                <Trash size={16} />
                {confirmDelete ? 'Confirm delete' : 'Delete'}
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={onDismiss}
                className="px-4 py-2 rounded-xl text-[13px] text-stone-600 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!title.trim()}
                className="px-4 py-2 rounded-xl text-[13px] font-medium bg-stone-900 text-white hover:bg-stone-800 transition-colors disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
