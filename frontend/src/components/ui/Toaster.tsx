import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Optional action label + callback (e.g. "Undo"). */
  action?: { label: string; onClick: () => void };
  /** Milliseconds before auto-dismiss. Pass 0 to disable. Default 5000. */
  duration: number;
}

interface ShowToastInput {
  message: string;
  variant?: ToastVariant;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastContextValue {
  show: (input: ShowToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Canonical toast context — replaces the scattered inline toasts
 * (QuickAddFAB local state, CopToast, completion toast) with one
 * ordered, stackable surface.
 *
 * Accessibility:
 * - `role="status" aria-live="polite"` for `info`/`success`/`warning`
 * - `role="alert" aria-live="assertive"` for `error` — user should
 *   interrupt their current task
 * - Toasts auto-dismiss but pause their timer on hover/focus (via
 *   `onMouseEnter` / `onFocus` on each Toast element)
 * - Respects `prefers-reduced-motion` via the MotionConfig at app root
 */
export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing) {
      window.clearTimeout(existing);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id: string, duration: number) => {
      if (duration <= 0) return;
      const existing = timersRef.current.get(id);
      if (existing) window.clearTimeout(existing);
      const handle = window.setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, handle);
    },
    [dismiss],
  );

  const show = useCallback(
    (input: ShowToastInput): string => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const toast: Toast = {
        id,
        message: input.message,
        variant: input.variant ?? 'info',
        action: input.action,
        duration: input.duration ?? 5000,
      };
      setToasts((prev) => [...prev, toast]);
      scheduleDismiss(id, toast.duration);
      return id;
    },
    [scheduleDismiss],
  );

  const pauseTimer = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing) {
      window.clearTimeout(existing);
      timersRef.current.delete(id);
    }
  }, []);

  const resumeTimer = useCallback(
    (id: string) => {
      const toast = toasts.find((t) => t.id === id);
      if (toast) scheduleDismiss(id, toast.duration);
    },
    [toasts, scheduleDismiss],
  );

  // Drain timers on unmount.
  useEffect(() => {
    return () => {
      const map = timersRef.current;
      map.forEach((handle) => window.clearTimeout(handle));
      map.clear();
    };
  }, []);

  const ctx = useMemo<ToastContextValue>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        className="fixed z-[110] bottom-0 left-0 right-0 flex flex-col items-center gap-2 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pointer-events-none md:pb-6"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="pointer-events-auto w-full max-w-sm md-shape-full md-elevation-3"
              onMouseEnter={() => pauseTimer(toast.id)}
              onMouseLeave={() => resumeTimer(toast.id)}
              onFocus={() => pauseTimer(toast.id)}
              onBlur={() => resumeTimer(toast.id)}
            >
              <div
                role={toast.variant === 'error' ? 'alert' : 'status'}
                aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
                className="flex items-center gap-3 px-4 py-3"
                style={variantStyles(toast.variant)}
              >
                <span className="md-body-medium flex-1">{toast.message}</span>
                {toast.action && (
                  <button
                    onClick={() => {
                      toast.action!.onClick();
                      dismiss(toast.id);
                    }}
                    className="md-label-large md-shape-full md-duration-short3 md-ease-standard px-3 py-1 transition-colors"
                    style={{
                      color:
                        toast.variant === 'error'
                          ? 'var(--md-sys-color-on-error-container)'
                          : 'var(--md-sys-color-inverse-primary)',
                    }}
                  >
                    {toast.action.label}
                  </button>
                )}
                <button
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="md-shape-full md-duration-short3 md-ease-standard p-1 -mr-1 transition-colors"
                  style={{ color: 'currentColor', opacity: 0.7 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function variantStyles(variant: ToastVariant): React.CSSProperties {
  switch (variant) {
    case 'success':
      return {
        backgroundColor: 'var(--md-sys-color-primary-container)',
        color: 'var(--md-sys-color-on-primary-container)',
      };
    case 'warning':
      return {
        backgroundColor: 'var(--md-sys-color-tertiary-container)',
        color: 'var(--md-sys-color-on-tertiary-container)',
      };
    case 'error':
      return {
        backgroundColor: 'var(--md-sys-color-error-container)',
        color: 'var(--md-sys-color-on-error-container)',
      };
    case 'info':
    default:
      return {
        backgroundColor: 'var(--md-sys-color-inverse-surface)',
        color: 'var(--md-sys-color-inverse-on-surface)',
      };
  }
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToasterProvider> at the app root.');
  }
  return ctx;
}
