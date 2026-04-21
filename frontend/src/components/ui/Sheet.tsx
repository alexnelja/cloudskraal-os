import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type SheetVariant = 'modal' | 'side' | 'bottom';
type SidePivot = 'start' | 'end';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** `modal` (centered) | `side` (full-height drawer) | `bottom` (sliding sheet). Default `modal`. */
  variant?: SheetVariant;
  /** Which edge a `side` variant docks to. `end` = right. Default `end`. */
  pivot?: SidePivot;
  /** Disable backdrop click-to-close. Default false. */
  disableBackdropClose?: boolean;
  /** Custom max-width for modal / side variants (ignored for bottom). Tailwind class. */
  widthClass?: string;
  /** Optional id for the header; set automatically from title if omitted. */
  id?: string;
  children: ReactNode;
}

/**
 * Canonical dialog surface — unifies the six hand-rolled modal / sheet
 * components catalogued by the consistency audit (ProjectModal,
 * TaskEditor, EventEditor, TaskDetailSheet, FluidDialog, FluidSheet).
 *
 * Features:
 * - `role="dialog" aria-modal="true" aria-labelledby` everywhere.
 * - Keyboard: Escape closes.
 * - Focus: on open, moves focus into the panel (first focusable element).
 *   On close, returns focus to the element that was active before.
 * - Backdrop: dismisses unless `disableBackdropClose`.
 * - Safe-area insets on the `bottom` variant.
 * - Motion follows MD3 emphasized-decelerate / -accelerate easings;
 *   honours prefers-reduced-motion via the root MotionConfig.
 */
export default function Sheet({
  open,
  onClose,
  title,
  variant = 'modal',
  pivot = 'end',
  disableBackdropClose = false,
  widthClass,
  id = 'sheet',
  children,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Focus management — capture the previously-focused element, move focus
  // into the panel on open, restore focus on close.
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => {
        if (!panelRef.current) return;
        const first = panelRef.current.querySelector<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        (first ?? panelRef.current).focus();
      }, 20);
      return () => clearTimeout(t);
    } else if (returnFocusRef.current) {
      returnFocusRef.current.focus();
      returnFocusRef.current = null;
    }
  }, [open]);

  const labelledBy = title ? `${id}-title` : undefined;

  // Variant-specific geometry — panel classes + motion variants.
  const panelLayout =
    variant === 'modal'
      ? `relative ${widthClass ?? 'w-full max-w-lg'} mx-4 max-h-[90vh] overflow-y-auto md-shape-extra-large md-elevation-3`
      : variant === 'side'
        ? `fixed top-0 ${pivot === 'end' ? 'right-0' : 'left-0'} h-full ${
            widthClass ?? 'w-full max-w-md'
          } overflow-y-auto md-elevation-3`
        : `fixed bottom-0 left-0 right-0 max-h-[92vh] overflow-y-auto md-shape-large md-elevation-3 pb-[env(safe-area-inset-bottom)]`;

  const motionInitial =
    variant === 'modal'
      ? { opacity: 0, y: 16, scale: 0.96 }
      : variant === 'side'
        ? { opacity: 0, x: pivot === 'end' ? 40 : -40 }
        : { opacity: 0, y: 40 };

  const motionAnimate =
    variant === 'modal' ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, x: 0, y: 0 };

  const motionExit =
    variant === 'modal'
      ? { opacity: 0, y: 8, scale: 0.98 }
      : variant === 'side'
        ? { opacity: 0, x: pivot === 'end' ? 40 : -40 }
        : { opacity: 0, y: 40 };

  return (
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 z-[100] ${
            variant === 'modal' ? 'flex items-center justify-center' : ''
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
        >
          <motion.div
            className="absolute inset-0 backdrop-blur-sm"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--md-sys-color-scrim) 40%, transparent)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={disableBackdropClose ? undefined : onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className={panelLayout}
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)',
            }}
            initial={motionInitial}
            animate={motionAnimate}
            exit={motionExit}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            {title && (
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}
              >
                <h2 id={labelledBy} className="md-title-large">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="md-shape-full p-2 -mr-2 md-duration-short3 md-ease-standard transition-colors"
                  style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
