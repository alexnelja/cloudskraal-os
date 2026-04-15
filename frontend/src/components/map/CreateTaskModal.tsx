import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ClipboardText } from '@phosphor-icons/react';
import type { CreateTaskInput } from '../../api/tasks';
import FluidDialog from './FluidDialog';

export type TaskContext =
  | { kind: 'blank'; label: string }
  | { kind: 'field'; label: string; fieldId: string }
  | { kind: 'annotation'; label: string; annotationId: string };

interface CreateTaskModalProps {
  open: boolean;
  defaultTitle?: string;
  context: TaskContext;
  onSave: (input: CreateTaskInput) => void;
  onCancel: () => void;
}

export default function CreateTaskModal({
  open,
  defaultTitle = '',
  context,
  onSave,
  onCancel,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState<string>('');

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setNotes('');
      setPriority('medium');
      setDueDate('');
    }
  }, [open, defaultTitle]);

  const canSave = title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const payload: CreateTaskInput = {
      title: title.trim(),
      notes: notes.trim() || null,
      priority,
      due_date: dueDate || null,
    };
    if (context.kind === 'field') payload.field_id = context.fieldId;
    if (context.kind === 'annotation') payload.annotation_id = context.annotationId;
    onSave(payload);
  };

  const contextLine =
    context.kind === 'field'
      ? `for field ${context.label}`
      : context.kind === 'annotation'
      ? `linked to ${context.label}`
      : `at ${context.label}`;

  return (
    <FluidDialog open={open} onDismiss={onCancel}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            initial={{ scale: 0.7, rotate: -6, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 480, damping: 22 }}
            className="p-2.5 rounded-xl text-emerald-800"
            style={{
              background:
                'linear-gradient(135deg, rgba(209, 250, 229, 0.95), rgba(167, 243, 208, 0.65))',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 4px 12px -4px rgba(6, 95, 70, 0.25)',
            }}
          >
            <ClipboardText size={22} weight="duotone" />
          </motion.div>
          <div>
            <h2 className="text-xl font-serif font-medium text-stone-900 tracking-tight">
              New task
            </h2>
            <p className="text-[11px] text-stone-500 mt-0.5">{contextLine}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="task-title"
              className="block text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-600 mb-1.5"
            >
              Title
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="w-full glass-input rounded-lg px-3 py-2 text-stone-900 placeholder-stone-400"
              placeholder="What needs doing?"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="task-priority"
                className="block text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-600 mb-1.5"
              >
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="w-full glass-input rounded-lg px-3 py-2 text-stone-900 appearance-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="task-due"
                className="block text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-600 mb-1.5"
              >
                Due
              </label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full glass-input rounded-lg px-3 py-2 text-stone-900"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="task-notes"
              className="block text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-600 mb-1.5"
            >
              Notes
            </label>
            <textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full glass-input rounded-lg px-3 py-2 text-stone-900 placeholder-stone-400 resize-none"
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg transition"
          >
            Cancel
          </button>
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            whileTap={{ scale: canSave ? 0.96 : 1 }}
            whileHover={{ scale: canSave ? 1.02 : 1 }}
            className="px-4 py-2 rounded-lg text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
            style={{
              background: canSave
                ? 'linear-gradient(135deg, #059669, #047857)'
                : '#9ca3af',
              boxShadow: canSave
                ? 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 4px 12px -2px rgba(4, 120, 87, 0.45)'
                : 'none',
            }}
          >
            Save
          </motion.button>
        </div>
      </div>
    </FluidDialog>
  );
}
