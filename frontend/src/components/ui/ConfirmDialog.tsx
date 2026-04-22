import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** Label on the confirm button. Default "Confirm". */
  confirmLabel?: string;
  /** Label on the cancel button. Default "Cancel". */
  cancelLabel?: string;
  /** Style the confirm button with the MD3 error role (destructive). Default `false`. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Canonical confirmation dialog — replaces `window.confirm()` calls
 * identified by the UX audit (TagManager, AnnotationsSidebar). Focus
 * moves to the cancel button on open, Escape cancels, and the backdrop
 * click cancels. Focus is restored to the previously-focused element
 * on close.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => cancelRef.current?.focus(), 10);
      return () => clearTimeout(t);
    } else if (returnFocusRef.current) {
      returnFocusRef.current.focus();
      returnFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby={description ? 'confirm-dialog-desc' : undefined}
        >
          <motion.div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ backgroundColor: 'color-mix(in srgb, var(--md-sys-color-scrim) 40%, transparent)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            aria-hidden="true"
          />
          <motion.div
            className="relative md-shape-extra-large md-elevation-3 p-6 w-full max-w-sm"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)',
            }}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <h2 id="confirm-dialog-title" className="md-headline-small mb-2">
              {title}
            </h2>
            {description && (
              <p
                id="confirm-dialog-desc"
                className="md-body-medium mb-6"
                style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
              >
                {description}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                ref={cancelRef}
                onClick={onCancel}
                className="md-label-large md-shape-full md-duration-short3 md-ease-standard px-5 py-2.5 transition-colors"
                style={{ color: 'var(--md-sys-color-primary)' }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className="md-label-large md-shape-full md-duration-short3 md-ease-standard px-5 py-2.5 transition-colors"
                style={{
                  backgroundColor: destructive
                    ? 'var(--md-sys-color-error)'
                    : 'var(--md-sys-color-primary)',
                  color: destructive
                    ? 'var(--md-sys-color-on-error)'
                    : 'var(--md-sys-color-on-primary)',
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
