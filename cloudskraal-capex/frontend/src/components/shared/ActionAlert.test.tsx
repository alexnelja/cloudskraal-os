import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ActionAlert from './ActionAlert';

function renderAlert(props: { severity: 'critical' | 'warning' | 'info'; message: string; actionLabel: string; actionTo: string }) {
  return render(
    <MemoryRouter>
      <ActionAlert {...props} />
    </MemoryRouter>
  );
}

const baseProps = { message: 'Low stock', actionLabel: 'View', actionTo: '/stock' };

describe('ActionAlert', () => {
  it('renders message and action link', () => {
    renderAlert({ ...baseProps, severity: 'warning' });
    expect(screen.getByText('Low stock')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  it('applies critical severity styling', () => {
    const { container } = renderAlert({ ...baseProps, severity: 'critical' });
    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toContain('bg-red-50');
    expect(wrapper.className).toContain('border-red-200');
  });

  it('applies warning severity styling', () => {
    const { container } = renderAlert({ ...baseProps, severity: 'warning' });
    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toContain('bg-amber-50');
    expect(wrapper.className).toContain('border-amber-200');
  });

  it('applies info severity styling', () => {
    const { container } = renderAlert({ ...baseProps, severity: 'info' });
    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toContain('bg-blue-50');
    expect(wrapper.className).toContain('border-blue-200');
  });

  it('action link navigates to correct path', () => {
    renderAlert({ ...baseProps, severity: 'warning' });
    const link = screen.getByText('View');
    expect(link.closest('a')).toHaveAttribute('href', '/stock');
  });
});
