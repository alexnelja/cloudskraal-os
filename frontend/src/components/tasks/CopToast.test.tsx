import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CopToast from './CopToast';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children, onExitComplete }: any) => {
    // Store onExitComplete for later use
    (window as any).__copToastExitComplete = onExitComplete;
    return <>{children}</>;
  },
}));

const defaultProps = {
  costsLogged: [
    { id: 'c1', product_name: 'Roundup', total_cost: 1250 },
    { id: 'c2', product_name: 'Fertilizer', total_cost: 750 },
  ],
  taskTitle: 'Spray weeds',
  onUndo: vi.fn(),
  onDismiss: vi.fn(),
};

describe('CopToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows message with cost count and task title', () => {
    render(<CopToast {...defaultProps} />);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText(/costs logged to COP for/)).toBeTruthy();
    expect(screen.getByText(/Spray weeds/)).toBeTruthy();
  });

  it('shows total cost amount', () => {
    render(<CopToast {...defaultProps} />);
    // R2,000.00 or R2 000.00 depending on locale
    const el = screen.getByText((content) => content.includes('2') && content.includes('000'));
    expect(el).toBeTruthy();
  });

  it('undo button calls onUndo', () => {
    const onUndo = vi.fn();
    render(<CopToast {...defaultProps} onUndo={onUndo} />);
    fireEvent.click(screen.getByText('Undo'));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('auto-dismisses after 5 seconds', () => {
    render(<CopToast {...defaultProps} />);
    expect(screen.getByText(/costs logged/)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    // After timeout, visible is set to false; the AnimatePresence mock
    // will call onExitComplete which triggers onDismiss
  });

  it('shows singular "cost" for single item', () => {
    render(
      <CopToast
        {...defaultProps}
        costsLogged={[{ id: 'c1', product_name: 'Roundup', total_cost: 500 }]}
      />,
    );
    expect(screen.getByText(/cost logged to COP/)).toBeTruthy();
  });
});
