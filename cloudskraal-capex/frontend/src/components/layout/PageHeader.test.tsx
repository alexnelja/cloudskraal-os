import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PageHeader from './PageHeader';

function MockIcon(props: Record<string, unknown>) {
  return <svg data-testid="header-icon" {...props} />;
}

describe('PageHeader', () => {
  it('renders icon and title', () => {
    render(<PageHeader icon={MockIcon} title="Dashboard" />);
    expect(screen.getByTestId('header-icon')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders children in actions slot when provided', () => {
    render(
      <PageHeader icon={MockIcon} title="Dashboard">
        <button>Action</button>
      </PageHeader>
    );
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('renders without children (no actions div)', () => {
    const { container } = render(
      <PageHeader icon={MockIcon} title="Dashboard" />
    );
    // The actions wrapper div should not exist when no children are passed
    const headerDiv = container.firstElementChild!;
    // Only one child div (the icon+title group), no second div for actions
    expect(headerDiv.children).toHaveLength(1);
  });
});
