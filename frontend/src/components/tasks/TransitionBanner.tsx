import { motion, AnimatePresence } from 'motion/react';
import { Lightning, X } from '@phosphor-icons/react';
import type { TransitionSuggestion } from '../../lib/usagePeriodTriggers';

interface TransitionBannerProps {
  suggestions: TransitionSuggestion[];
  onGenerate: (fieldId: string) => void;
  onDismiss: (fieldId: string) => void;
}

export default function TransitionBanner({
  suggestions,
  onGenerate,
  onDismiss,
}: TransitionBannerProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="px-6 py-2 space-y-2">
      <AnimatePresence>
        {suggestions.map((s) => (
          <motion.div
            key={s.fieldId}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border"
            style={{
              background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
              borderColor: '#f59e0b',
            }}
          >
            <Lightning size={18} weight="fill" className="text-amber-600 flex-shrink-0" />
            <span className="flex-1 text-sm text-amber-900">
              <strong>{s.fieldName}</strong> transitioned to{' '}
              <strong>{s.toUsage}</strong> — generate tasks?
            </span>
            <button
              type="button"
              onClick={() => onGenerate(s.fieldId)}
              className="px-3 py-1 text-xs font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 transition-colors"
            >
              Generate
            </button>
            <button
              type="button"
              onClick={() => onDismiss(s.fieldId)}
              className="p-1 rounded-full text-amber-700 hover:text-amber-900 hover:bg-amber-200/50 transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} weight="bold" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
