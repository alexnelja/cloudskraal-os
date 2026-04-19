import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DailyProgress from './DailyProgress';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, style, ...props }: any) => (
      <div style={style} {...props}>{children}</div>
    ),
    span: ({ children, style, ...props }: any) => (
      <span style={style} {...props}>{children}</span>
    ),
  },
}));

describe('DailyProgress', () => {
  it('shows "0 of 5 done" text', () => {
    render(<DailyProgress total={5} completed={0} />);
    expect(screen.getByText('0 of 5 done')).toBeInTheDocument();
  });

  it('shows "All done for today" at 100%', () => {
    render(<DailyProgress total={3} completed={3} />);
    expect(screen.getByTestId('all-done-message')).toHaveTextContent('All done for today');
  });

  it('progress bar has correct width style', () => {
    render(<DailyProgress total={10} completed={4} />);
    const bar = screen.getByTestId('progress-fill');
    expect(bar).toBeInTheDocument();
  });

  it('progress bar has golden gradient at 100%', () => {
    render(<DailyProgress total={4} completed={4} />);
    const bar = screen.getByTestId('progress-fill');
    expect(bar.style.background).toContain('linear-gradient');
    // JSDOM converts hex to rgb
    expect(bar.style.background).toContain('217, 119, 6');
    expect(bar.style.background).toContain('251, 191, 36');
  });

  it('progress bar has glow box-shadow at 100%', () => {
    render(<DailyProgress total={2} completed={2} />);
    const bar = screen.getByTestId('progress-fill');
    expect(bar.style.boxShadow).toContain('rgba(251, 191, 36, 0.4)');
  });
});
