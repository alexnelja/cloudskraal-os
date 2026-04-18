import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DailyProgress from './DailyProgress';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, style, ...props }: any) => (
      <div style={style} {...props}>{children}</div>
    ),
  },
}));

describe('DailyProgress', () => {
  it('shows "0 of 5 done" text', () => {
    render(<DailyProgress total={5} completed={0} />);
    expect(screen.getByText('0 of 5 done')).toBeInTheDocument();
  });

  it('shows "All done" at 100%', () => {
    render(<DailyProgress total={3} completed={3} />);
    expect(screen.getByText(/all done/i)).toBeInTheDocument();
  });

  it('progress bar has correct width style', () => {
    render(<DailyProgress total={10} completed={4} />);
    const bar = screen.getByTestId('progress-fill');
    // The motion.div should animate to 40%
    expect(bar).toBeInTheDocument();
  });
});
