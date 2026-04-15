import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Circle, Flag } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../api/config';
import type { Task } from '../../api/tasks';

interface Props {
  taskId: string;
}

const PRIORITY_TINT: Record<string, string> = {
  high: 'text-rose-700 bg-rose-100/60',
  medium: 'text-amber-700 bg-amber-100/60',
  low: 'text-stone-600 bg-stone-100/60',
};

export default function WikiTaskBlock({ taskId }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/tasks/${taskId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setTask)
      .catch(() => setTask(null))
      .finally(() => setLoading(false));
  }, [taskId]);

  const toggle = async () => {
    if (!task || toggling) return;
    setToggling(true);
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const r = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (r.ok) setTask(await r.json());
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-stone-100/60 text-xs text-stone-400 animate-pulse my-1">
        Loading task…
      </span>
    );
  }
  if (!task) {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-stone-100 text-xs text-stone-500 my-1">
        Task unavailable
      </span>
    );
  }

  const done = task.status === 'completed';
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="my-2 glass-panel rounded-xl p-3 flex items-start gap-3"
    >
      <motion.button
        type="button"
        onClick={toggle}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        disabled={toggling}
        className="shrink-0 text-emerald-700 disabled:opacity-50"
        aria-label={done ? 'Mark pending' : 'Mark completed'}
      >
        {done ? (
          <CheckCircle size={22} weight="duotone" />
        ) : (
          <Circle size={22} weight="regular" />
        )}
      </motion.button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${done ? 'line-through text-stone-400' : 'text-stone-900'}`}>
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {task.priority && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${PRIORITY_TINT[task.priority]}`}
            >
              <Flag size={10} weight="fill" />
              {task.priority}
            </span>
          )}
          {task.due_date && (
            <span className="text-[11px] text-stone-500 font-mono">
              due {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
          {task.field_name && (
            <span className="text-[11px] text-stone-500">· {task.field_name}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
