import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../../types/calendar';
import { PRIORITY_COLORS } from '../../types/calendar';

interface BoardCardProps {
  task: Task;
  onSelect: (id: string) => void;
}

const MAX_VISIBLE_TAGS = 3;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return due < today;
}

export default function BoardCard({ task, onSelect }: BoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const tags = task.tags ?? [];
  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const overflowCount = tags.length - MAX_VISIBLE_TAGS;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(task.id)}
      className="bg-white rounded-lg border border-stone-200/60 p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      {/* Title row with priority dot */}
      <div className="flex items-start gap-2">
        <span
          data-testid="priority-dot"
          className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? '#9ca3af' }}
        />
        <span className="font-medium text-sm text-stone-900 truncate">
          {task.title}
        </span>
      </div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {visibleTags.map((tag) => (
            <span
              key={tag.id}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: tag.color + '18',
                color: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-stone-400 bg-stone-100">
              +{overflowCount}
            </span>
          )}
        </div>
      )}

      {/* Footer: due date + field */}
      <div className="flex items-center gap-2 mt-2">
        {task.due_date && (
          <span
            className={`text-[10px] ${
              isOverdue(task.due_date) ? 'text-red-500' : 'text-stone-500'
            }`}
          >
            {formatDate(task.due_date)}
          </span>
        )}
        {task.field_name && (
          <span className="text-[10px] text-stone-500">{task.field_name}</span>
        )}
      </div>
    </div>
  );
}
