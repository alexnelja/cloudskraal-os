import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLongPress } from './useLongPress';

function makePointerEvent(
  type: string,
  { clientX = 0, clientY = 0, pointerId = 1 }: { clientX?: number; clientY?: number; pointerId?: number } = {},
): React.PointerEvent {
  return {
    type,
    clientX,
    clientY,
    pointerId,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.PointerEvent;
}

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onLongPress after the default 500ms hold', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown', { clientX: 10, clientY: 20 }));
    });
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledWith({ clientX: 10, clientY: 20 });
  });

  it('respects custom duration', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, durationMs: 1000 }));

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown'));
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('cancels when pointer moves more than the threshold', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
      result.current.onPointerMove(makePointerEvent('pointermove', { clientX: 10, clientY: 0 })); // > 4px
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('allows small jitter below the threshold', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
      result.current.onPointerMove(makePointerEvent('pointermove', { clientX: 2, clientY: 2 })); // < 4px
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('cancels on early pointerup', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown'));
      vi.advanceTimersByTime(200);
      result.current.onPointerUp(makePointerEvent('pointerup'));
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels on pointercancel', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown'));
      result.current.onPointerCancel(makePointerEvent('pointercancel'));
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('invokes onProgress while holding so the UI can draw an affordance', () => {
    const onProgress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress: () => {}, onProgress }));

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown', { clientX: 50, clientY: 60 }));
    });
    expect(onProgress).toHaveBeenCalledWith({ active: true, clientX: 50, clientY: 60 });

    act(() => {
      result.current.onPointerUp(makePointerEvent('pointerup'));
    });
    expect(onProgress).toHaveBeenLastCalledWith({ active: false });
  });
});
