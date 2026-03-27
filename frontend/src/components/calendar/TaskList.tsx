import { Clock, Zap, Link, Hand, CheckCircle2 } from 'lucide-react';
import type { Task } from '../../types/calendar';
import { PRIORITY_COLORS, STATUS_COLORS } from '../../types/calendar';
import { ENTERPRISE_COLORS, ENTERPRISE_LABELS } from '../../types/farm';

interface TaskListProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
  onComplete: (taskId: string) => void;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  scheduled: Clock,
  triggered: Zap,
  dependent: Link,
  manual: Hand,
};

function relativeDueDate(dueDate: string | null): { text: string; overdue: boolean } {
  if (!dueDate) return { text: 'No due date', overdue: false };

  const due = new Date(dueDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { text: 'Today', overdue: false };
  if (diffDays === 1) return { text: 'Tomorrow', overdue: false };
  if (diffDays === -1) return { text: 'Yesterday', overdue: true };
  if (diffDays > 1) return { text: `In ${diffDays} days`, overdue: false };
  return { text: `${Math.abs(diffDays)} days ago`, overdue: true };
}

export default function TaskList({ tasks, selectedTaskId, onSelect, onComplete }: TaskListProps) {
  // Sort: overdue first (ascending due_date), then upcoming
  const sorted = [...tasks].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  return (
    <div className="space-y-2">
      {sorted.map((task) => {
        const isCompleted = task.status === 'completed';
        const isSelected = task.id === selectedTaskId;
        const TypeIcon = TYPE_ICONS[task.type] ?? Clock;
        const due = relativeDueDate(task.due_date);
        const priorityColor = PRIORITY_COLORS[task.priority] ?? '#9ca3af';
        const statusColor = STATUS_COLORS[task.status] ?? '#9ca3af';
        const enterpriseColor = ENTERPRISE_COLORS[task.enterprise ?? ''] ?? '#6b7280';
        const enterpriseLabel = ENTERPRISE_LABELS[task.enterprise ?? ''] ?? task.enterprise;

        return (
          <div
            key={task.id}
            onClick={() => onSelect(task.id)}
            className={`
              relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer
              transition-colors
              ${isSelected ? 'border-emerald-300 bg-emerald-50/50' : 'border-stone-150 bg-white hover:bg-stone-50'}
              ${isCompleted ? 'opacity-60' : ''}
            `}
            style={{ borderLeftWidth: 3, borderLeftColor: priorityColor }}
          >
            {/* Complete button */}
            {!isCompleted && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete(task.id);
                }}
                className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 border-stone-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
                title="Complete task"
              />
            )}
            {isCompleted && (
              <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5 text-emerald-600" />
            )}

            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex items-center gap-2 mb-1">
                <TypeIcon size={14} className="flex-shrink-0 text-stone-400" />
                <span
                  className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-stone-400' : 'text-stone-800'}`}
                >
                  {task.title}
                </span>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Enterprise badge */}
                {task.enterprise && (
                  <span
                    className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: enterpriseColor }}
                  >
                    {enterpriseLabel}
                  </span>
                )}

                {/* Due date */}
                <span className={`text-[11px] ${due.overdue ? 'text-red-600 font-medium' : 'text-stone-400'}`}>
                  {due.text}
                </span>

                {/* Status badge */}
                <span
                  className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white capitalize"
                  style={{ backgroundColor: statusColor }}
                >
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
