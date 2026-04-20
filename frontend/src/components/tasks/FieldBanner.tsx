import { MapPin, ArrowRight } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';

interface FieldBannerProps {
  field: { fieldId: string; fieldName: string } | null;
  taskCount: number;
  onShow: () => void;
}

export default function FieldBanner({ field, taskCount, onShow }: FieldBannerProps) {
  return (
    <AnimatePresence>
      {field && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="mx-4 mt-2 mb-1 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200/60 px-3 py-2"
        >
          <MapPin size={18} weight="duotone" className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-900 flex-1 min-w-0 truncate">
            You're in <span className="font-medium">{field.fieldName}</span>
            {taskCount > 0 && (
              <> &mdash; {taskCount} {taskCount === 1 ? 'task' : 'tasks'}</>
            )}
          </span>
          <button
            type="button"
            onClick={onShow}
            className="flex items-center gap-0.5 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors whitespace-nowrap"
          >
            Show
            <ArrowRight size={14} weight="bold" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
