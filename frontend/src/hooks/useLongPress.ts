import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface LongPressFire {
  clientX: number;
  clientY: number;
}

export type LongPressProgress =
  | { active: true; clientX: number; clientY: number }
  | { active: false };

export interface UseLongPressOptions {
  onLongPress: (fire: LongPressFire) => void;
  /** Milliseconds the pointer must stay pressed before firing. Defaults to 500. */
  durationMs?: number;
  /** Max pixel movement before the press is cancelled. Defaults to 4. */
  moveThresholdPx?: number;
  /** Optional callback for rendering a visual affordance during the hold. */
  onProgress?: (progress: LongPressProgress) => void;
}

interface LongPressHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
}

/**
 * Fires `onLongPress` when the pointer is held stationary for `durationMs`.
 * Cancels cleanly on movement >threshold, early release, or pointercancel.
 *
 * Natural fit for "hold to drop pin" on a MacBook trackpad — matches the
 * Apple Maps / Google Maps interaction where right-click is awkward.
 */
export function useLongPress({
  onLongPress,
  durationMs = 500,
  moveThresholdPx = 4,
  onProgress,
}: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    originRef.current = null;
    onProgress?.({ active: false });
  }, [onProgress]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      originRef.current = { x, y };
      onProgress?.({ active: true, clientX: x, clientY: y });
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        originRef.current = null;
        onProgress?.({ active: false });
        onLongPress({ clientX: x, clientY: y });
      }, durationMs);
    },
    [durationMs, onLongPress, onProgress],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const origin = originRef.current;
      if (!origin || timerRef.current === null) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      if (dx * dx + dy * dy > moveThresholdPx * moveThresholdPx) {
        clear();
      }
    },
    [clear, moveThresholdPx],
  );

  const onPointerUp = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerCancel = useCallback(() => {
    clear();
  }, [clear]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
