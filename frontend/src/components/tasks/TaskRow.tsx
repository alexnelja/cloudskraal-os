import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from '@phosphor-icons/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../../types/calendar';
import type { TaskStatusConfig } from '../../types/taskManager';

interface TaskRowProps {
  task: Task;
  statuses: TaskStatusConfig[];
  onComplete: (id: string) => void;
  onSelect: (id: string) => void;
  selected?: boolean;
  sortableId?: string;
}

function formatDueLabel(dueDate: string | null): string {
  if (!dueDate) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < -1) return `${Math.abs(diffDays)}d ago`;
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (diffDays > 1 && diffDays <= 6) return dayNames[due.getDay()];
  return due.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
}

function isDueOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  return due < today;
}

export default function TaskRow({
  task,
  statuses,
  onComplete,
  onSelect,
  selected = false,
  sortableId,
}: TaskRowProps) {
  const isCompleted = task.status === 'completed';
  const overdue = isDueOverdue(task.due_date);
  const isUrgent = task.priority === 'urgent' || task.priority === 'high';
  const [completing, setCompleting] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId ?? task.id, disabled: !sortableId });

  const sortableStyle = sortableId
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }
    : {};

  const handleComplete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleted) return;
    navigator.vibrate?.(15);
    setCompleting(true);
    // Animate the checkmark, then call onComplete after a brief delay
    setTimeout(() => {
      onComplete(task.id);
    }, 400);
  }, [isCompleted, onComplete, task.id]);

  // Build metadata line: priority, tags (comma-separated text), field
  const metaParts: string[] = [];
  if (isUrgent) {
    // Priority shown as text in metadata
  }
  if (task.tags && task.tags.length > 0) {
    metaParts.push(task.tags.map((t) => t.name).join(', '));
  }
  if (task.field_name) {
    metaParts.push(task.field_name);
  }
  if (task.blocked_reason) {
    metaParts.push(`Blocked (${task.blocked_reason})`);
  }
  const metaLine = metaParts.join(' \u00B7 ');

  return (
    <AnimatePresence>
      {!completing || isCompleted ? (
        <motion.li
          ref={sortableId ? setNodeRef : undefined}
          layout
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: isCompleted ? 0.5 : 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="px-5 py-3.5 cursor-pointer transition-colors list-none"
          style={{
            ...sortableStyle,
            backgroundColor: selected ? 'rgba(59, 130, 246, 0.06)' : undefined,
          }}
          onClick={() => onSelect(task.id)}
          {...(sortableId ? { ...attributes, ...listeners } : {})}
        >
          <div className="flex items-start gap-3">
            {/* Checkbox */}
            <button
              type="button"
              aria-label="Complete task"
              onClick={handleComplete}
              className={`mt-0.5 shrink-0 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                isCompleted || completing
                  ? 'bg-[#22c55e] border-[#22c55e]'
                  : 'border-stone-300 hover:border-stone-400'
              }`}
            >
              {(isCompleted || completing) && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  <Check size={12} weight="bold" className="text-white" />
                </motion.span>
              )}
            </button>

            {/* Center content */}
            <div className="flex-1 min-w-0">
              <span
                className={`text-[15px] text-stone-900 ${
                  isCompleted ? 'line-through opacity-50' : ''
                }`}
              >
                {isUrgent && !isCompleted && (
                  <span data-testid="priority-dot" className="text-amber-500 font-semibold mr-1">!</span>
                )}
                {task.title}
              </span>

              {metaLine && (
                <p className="text-[13px] text-stone-400 mt-0.5 truncate">
                  {metaLine}
                </p>
              )}
            </div>

            {/* Right: due date */}
            {task.due_date && (
              <span className={`text-[13px] shrink-0 mt-0.5 ${
                overdue && !isCompleted ? 'text-red-500 font-medium' : 'text-stone-400'
              }`}>
                {formatDueLabel(task.due_date)}
              </span>
            )}
          </div>
        </motion.li>
      ) : (
        <motion.li
          key={`completing-${task.id}`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="list-none overflow-hidden"
        />
      )}
    </AnimatePresence>
  );
}
