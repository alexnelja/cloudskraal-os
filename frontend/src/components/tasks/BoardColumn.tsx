import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '../../types/calendar';
import type { TaskStatusConfig } from '../../types/taskManager';
import BoardCard from './BoardCard';

interface BoardColumnProps {
  status: TaskStatusConfig;
  tasks: Task[];
  onSelectTask: (id: string) => void;
}

export default function BoardColumn({ status, tasks, onSelectTask }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div className="min-w-[280px] w-[280px] flex flex-col h-full">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2 mb-2">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: status.color }}
        />
        <span className="font-medium text-sm text-stone-800">{status.name}</span>
        <span className="text-[11px] text-stone-400 bg-stone-100 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
          {tasks.length}
        </span>
      </div>

      {/* Card list */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto rounded-xl border p-2 transition-colors ${
          isOver
            ? 'bg-amber-50/60 border-amber-300/50'
            : 'bg-stone-50/50 border-stone-200/40'
        }`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {tasks.map((task) => (
                <BoardCard key={task.id} task={task} onSelect={onSelectTask} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 border border-dashed border-stone-300/50 rounded-lg">
              <span className="text-xs text-stone-400">No tasks</span>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
