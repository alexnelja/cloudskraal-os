import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface FluidSheetProps {
  open: boolean;
  onDismiss: () => void;
  side?: 'left' | 'right';
  width?: string;
  children: React.ReactNode;
}

/**
 * A frosted side-sheet that slides in with spring physics.
 * Backdrop-blur merges the sheet with the map layer below.
 * Does NOT block map interaction — the backdrop itself is non-modal.
 */
export default function FluidSheet({
  open,
  onDismiss,
  side = 'right',
  width = 'w-[22rem]',
  children,
}: FluidSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  const x0 = side === 'right' ? '105%' : '-105%';

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className={`absolute top-0 ${side}-0 h-full ${width} z-30 flex flex-col`}
          initial={{ x: x0, opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: x0, opacity: 0.8 }}
          transition={{
            type: 'spring',
            stiffness: 340,
            damping: 36,
            mass: 0.9,
          }}
          style={{
            backgroundColor: 'rgba(255, 253, 248, 0.88)',
            backdropFilter: 'blur(22px) saturate(165%)',
            WebkitBackdropFilter: 'blur(22px) saturate(165%)',
            borderLeft: side === 'right' ? '1px solid rgba(194, 167, 120, 0.3)' : undefined,
            borderRight: side === 'left' ? '1px solid rgba(194, 167, 120, 0.3)' : undefined,
            boxShadow:
              side === 'right'
                ? '-14px 0 40px -12px rgba(60, 40, 20, 0.25), -4px 0 14px -4px rgba(60, 40, 20, 0.15)'
                : '14px 0 40px -12px rgba(60, 40, 20, 0.25), 4px 0 14px -4px rgba(60, 40, 20, 0.15)',
          }}
        >
          {children}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
