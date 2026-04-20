import { useCallback } from 'react';

type TransitionType = 'slide-forward' | 'slide-back' | 'fade';

/**
 * Hook that wraps state updates in native view transitions.
 * Gracefully degrades on unsupported browsers (just runs the callback).
 */
export function useViewTransition() {
  const startTransition = useCallback((type: TransitionType, callback: () => void) => {
    if (!document.startViewTransition) {
      callback();
      return;
    }

    // Set the transition type on the root element for CSS to pick up
    document.documentElement.style.viewTransitionName = type;

    const transition = document.startViewTransition(() => {
      callback();
    });

    transition.finished.then(() => {
      document.documentElement.style.viewTransitionName = '';
    });
  }, []);

  return { startTransition };
}
