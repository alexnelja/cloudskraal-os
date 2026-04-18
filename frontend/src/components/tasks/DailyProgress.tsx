import { motion } from 'motion/react';

interface DailyProgressProps {
  total: number;
  completed: number;
}

export default function DailyProgress({ total, completed }: DailyProgressProps) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const allDone = total > 0 && completed >= total;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-stone-600">
          {allDone ? (
            <span className="text-amber-700 font-medium">All done</span>
          ) : (
            `${completed} of ${total} done`
          )}
        </span>
        <span className="text-[11px] text-stone-400 font-mono">{pct}%</span>
      </div>
      <div className="h-2 bg-stone-200/60 rounded-full overflow-hidden">
        <motion.div
          data-testid="progress-fill"
          className="h-full rounded-full"
          style={{
            background: allDone
              ? 'linear-gradient(90deg, #f59e0b, #d97706, #b45309)'
              : 'linear-gradient(90deg, #fbbf24, #d97706)',
            boxShadow: allDone ? '0 0 8px rgba(217, 119, 6, 0.4)' : 'none',
          }}
          initial={{ width: '0%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        />
      </div>
    </div>
  );
}
