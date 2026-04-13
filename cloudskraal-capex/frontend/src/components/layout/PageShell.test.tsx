import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PageShell from './PageShell';

describe('PageShell', () => {
  it('renders children inside a full-height flex container', () => {
    render(
      <PageShell>
        <p>Child content</p>
      </PageShell>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('has correct CSS classes for layout', () => {
    const { container } = render(
      <PageShell>
        <p>Test</p>
      </PageShell>
    );
    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toContain('flex');
    expect(wrapper.className).toContain('flex-col');
    expect(wrapper.className).toContain('overflow-hidden');
  });
});
