import { motion } from 'motion/react';
import { Check } from '@phosphor-icons/react';
import type { Task } from '../../types/calendar';
import { PRIORITY_COLORS } from '../../types/calendar';
import type { TaskStatusConfig } from '../../types/taskManager';

interface TaskRowProps {
  task: Task;
  statuses: TaskStatusConfig[];
  onComplete: (id: string) => void;
  onSelect: (id: string) => void;
  selected?: boolean;
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
  return `In ${diffDays}d`;
}

export default function TaskRow({
  task,
  statuses,
  onComplete,
  onSelect,
  selected = false,
}: TaskRowProps) {
  const isCompleted = task.status === 'completed';
  const priorityColor = PRIORITY_COLORS[task.priority] ?? '#9ca3af';
  const matchedStatus = statuses.find((s) => s.id === task.status_id);
  const statusColor = matchedStatus?.color ?? task.status_color ?? '#9ca3af';
  const statusName = matchedStatus?.name ?? task.status_name ?? task.status;

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className="border-b border-stone-200/50 px-4 py-3 cursor-pointer transition-colors list-none"
      style={{
        background: selected
          ? 'linear-gradient(90deg, rgba(254, 243, 199, 0.7), rgba(254, 243, 199, 0))'
          : undefined,
        borderLeft: selected ? '2px solid #d97706' : '2px solid transparent',
      }}
      onClick={() => onSelect(task.id)}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          type="button"
          aria-label="Complete task"
          onClick={(e) => {
            e.stopPropagation();
            navigator.vibrate?.(15);
            onComplete(task.id);
          }}
          className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            isCompleted
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-stone-300 hover:border-amber-500'
          }`}
        >
          {isCompleted && <Check size={12} weight="bold" className="text-white" />}
        </button>

        {/* Center content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              data-testid="priority-dot"
              className="shrink-0 w-2 h-2 rounded-full"
              style={{ backgroundColor: priorityColor }}
            />
            <span
              className={`font-medium text-stone-900 truncate ${
                isCompleted ? 'line-through opacity-50' : ''
              }`}
            >
              {task.title}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {task.tags?.map((tag) => (
              <span
                key={tag.id}
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: tag.color + '20',
                  color: tag.color,
                }}
              >
                {tag.name}
              </span>
            ))}
            {task.field_name && (
              <span className="text-[10px] text-stone-400 font-mono">
                {task.field_name}
              </span>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[11px] text-stone-500 font-mono">
            {formatDueLabel(task.due_date)}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: statusColor + '20',
              color: statusColor,
            }}
          >
            {statusName}
          </span>
        </div>
      </div>
    </motion.li>
  );
}
