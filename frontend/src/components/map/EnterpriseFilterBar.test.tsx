import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EnterpriseFilterBar from './EnterpriseFilterBar';

const enterprises = ['rooibos', 'sheep', 'fallow', 'farm_boundary', 'unclassified'];

describe('EnterpriseFilterBar', () => {
  it('renders pills for non-boundary/unclassified enterprises', () => {
    render(
      <EnterpriseFilterBar
        enterprises={enterprises}
        visibleEnterprises={['rooibos', 'sheep', 'fallow']}
        onToggle={vi.fn()}
        onShowAll={vi.fn()}
      />,
    );
    expect(screen.getByText('Rooibos')).toBeInTheDocument();
    expect(screen.getByText('Sheep / Grazing')).toBeInTheDocument();
    expect(screen.getByText('Fallow')).toBeInTheDocument();
    expect(screen.queryByText('Farm Boundary')).not.toBeInTheDocument();
    expect(screen.queryByText('Unclassified')).not.toBeInTheDocument();
  });

  it('calls onToggle when a pill is clicked', () => {
    const onToggle = vi.fn();
    render(
      <EnterpriseFilterBar
        enterprises={enterprises}
        visibleEnterprises={['rooibos', 'sheep', 'fallow']}
        onToggle={onToggle}
        onShowAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Sheep / Grazing'));
    expect(onToggle).toHaveBeenCalledWith('sheep');
  });

  it('marks active pills with aria-pressed=true', () => {
    render(
      <EnterpriseFilterBar
        enterprises={enterprises}
        visibleEnterprises={['rooibos']}
        onToggle={vi.fn()}
        onShowAll={vi.fn()}
      />,
    );
    expect(screen.getByText('Rooibos')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Fallow')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows "Show all" when some enterprises are hidden', () => {
    const onShowAll = vi.fn();
    render(
      <EnterpriseFilterBar
        enterprises={enterprises}
        visibleEnterprises={['rooibos']}
        onToggle={vi.fn()}
        onShowAll={onShowAll}
      />,
    );
    const btn = screen.getByText('Show all');
    fireEvent.click(btn);
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });

  it('hides "Show all" when all enterprises are visible', () => {
    render(
      <EnterpriseFilterBar
        enterprises={enterprises}
        visibleEnterprises={['rooibos', 'sheep', 'fallow']}
        onToggle={vi.fn()}
        onShowAll={vi.fn()}
      />,
    );
    expect(screen.queryByText('Show all')).not.toBeInTheDocument();
  });

  it('returns null when no displayable enterprises exist', () => {
    const { container } = render(
      <EnterpriseFilterBar
        enterprises={['farm_boundary', 'unclassified']}
        visibleEnterprises={[]}
        onToggle={vi.fn()}
        onShowAll={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});
