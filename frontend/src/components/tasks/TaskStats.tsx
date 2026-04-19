import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Task } from '../../types/calendar';

interface TaskStatsProps {
  tasks: Task[];
  completedToday: number;
  totalToday: number;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}

export default function TaskStats({ tasks }: TaskStatsProps) {
  const [expanded, setExpanded] = useState(false);

  const stats = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Tasks completed in last 7 days
    const completedLast7 = tasks.filter((t) => {
      if (t.status !== 'completed' || !t.completed_date) return false;
      const cd = new Date(t.completed_date);
      return cd >= sevenDaysAgo;
    });

    // Tasks due in last 7 days (for completion rate denominator)
    const dueLast7 = tasks.filter((t) => {
      if (!t.due_date) return false;
      const dd = new Date(t.due_date + 'T00:00:00');
      return dd >= sevenDaysAgo && dd <= now;
    });

    const completionRate =
      dueLast7.length > 0
        ? Math.round((completedLast7.length / dueLast7.length) * 100)
        : 0;

    const avgPerDay = Math.round((completedLast7.length / 7) * 10) / 10;

    // Streak: consecutive days (ending today/yesterday) with at least 1 completion
    let streak = 0;
    const today = startOfDay(now);
    // Check each day going backwards
    for (let i = 0; i <= 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const hasCompletion = tasks.some((t) => {
        if (t.status !== 'completed' || !t.completed_date) return false;
        return daysBetween(new Date(t.completed_date), checkDate) === 0;
      });
      if (hasCompletion) {
        streak++;
      } else if (i === 0) {
        // Today has no completions yet, that's ok - check from yesterday
        continue;
      } else {
        break;
      }
    }

    return { completionRate, avgPerDay, streak };
  }, [tasks]);

  const rateColor =
    stats.completionRate > 80
      ? 'text-emerald-600'
      : stats.completionRate > 50
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <div className="px-4 pb-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
        data-testid="stats-toggle"
      >
        {expanded ? 'Hide stats' : 'Stats'}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            data-testid="stats-panel"
          >
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-white/60 rounded-xl border border-stone-200/40 p-4 text-center">
                <span className={`text-2xl font-mono font-semibold ${rateColor}`} data-testid="completion-rate">
                  {stats.completionRate}%
                </span>
                <p className="text-[11px] text-stone-500 mt-1">Week rate</p>
              </div>
              <div className="bg-white/60 rounded-xl border border-stone-200/40 p-4 text-center">
                <span className="text-2xl font-mono font-semibold text-stone-800" data-testid="avg-per-day">
                  {stats.avgPerDay}
                </span>
                <p className="text-[11px] text-stone-500 mt-1">Avg / day</p>
              </div>
              <div className="bg-white/60 rounded-xl border border-stone-200/40 p-4 text-center">
                <span className="text-2xl font-mono font-semibold text-stone-800" data-testid="streak">
                  {stats.streak}
                </span>
                <p className="text-[11px] text-stone-500 mt-1">Day streak</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
