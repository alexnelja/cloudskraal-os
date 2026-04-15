import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface FluidDialogProps {
  open: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

/**
 * A translucent, blurred-backdrop dialog with spring entrance.
 * Dismisses on Escape and backdrop click. Content stays interactive.
 */
export default function FluidDialog({
  open,
  onDismiss,
  children,
  maxWidth = 'max-w-lg',
}: FluidDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          onClick={onDismiss}
        >
          {/* Backdrop: blurred, saturated satellite imagery peeks through */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: 'rgba(20, 18, 14, 0.45)',
              backdropFilter: 'blur(14px) saturate(140%)',
              WebkitBackdropFilter: 'blur(14px) saturate(140%)',
            }}
          />

          {/* Dialog panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative w-full ${maxWidth} rounded-2xl overflow-hidden`}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{
              type: 'spring',
              stiffness: 420,
              damping: 34,
              mass: 0.8,
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'rgba(255, 253, 248, 0.94)',
              backdropFilter: 'blur(24px) saturate(160%)',
              WebkitBackdropFilter: 'blur(24px) saturate(160%)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              boxShadow:
                '0 30px 60px -15px rgba(60, 40, 20, 0.35), 0 8px 24px -8px rgba(60, 40, 20, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
