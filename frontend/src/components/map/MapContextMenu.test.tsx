import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import MapContextMenu from './MapContextMenu';
import type { MenuItem } from './MapContextMenu';
import type { IconProps } from '@phosphor-icons/react';

// Minimal icon stub
const StubIcon = (_props: IconProps) => <svg data-testid="icon" />;

const items: MenuItem[] = [
  { id: 'add-field', label: 'Add Field', Icon: StubIcon, tint: 'emerald', onClick: vi.fn() },
  { id: 'drop-pin', label: 'Drop Pin', Icon: StubIcon, tint: 'amber', onClick: vi.fn() },
  { id: 'delete', label: 'Delete', Icon: StubIcon, tint: 'rose', onClick: vi.fn() },
];

function renderMenu(overrides: Partial<React.ComponentProps<typeof MapContextMenu>> = {}) {
  const onDismiss = vi.fn();
  const props = {
    open: true,
    x: 100,
    y: 100,
    items,
    onDismiss,
    ...overrides,
  };
  const result = render(<MapContextMenu {...props} />);
  return { ...props, onDismiss, ...result };
}

/** Flush requestAnimationFrame callbacks scheduled by the component */
function flushRaf() {
  act(() => {
    vi.runAllTimers();
  });
}

describe('MapContextMenu', () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    // Reset onClick mocks between tests
    items.forEach((item) => vi.mocked(item.onClick).mockReset());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders menu items with role="menuitem"', () => {
    renderMenu();
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems).toHaveLength(3);
    expect(menuItems[0]).toHaveTextContent('Add Field');
    expect(menuItems[1]).toHaveTextContent('Drop Pin');
    expect(menuItems[2]).toHaveTextContent('Delete');
  });

  it('menu items have tabIndex=-1', () => {
    renderMenu();
    const menuItems = screen.getAllByRole('menuitem');
    menuItems.forEach((item) => {
      expect(item).toHaveAttribute('tabindex', '-1');
    });
  });

  it('focuses the first item when the menu opens', () => {
    renderMenu();
    flushRaf();
    const menuItems = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(menuItems[0]);
  });

  it('ArrowDown moves focus to the next item', () => {
    renderMenu();
    flushRaf();
    const menuItems = screen.getAllByRole('menuitem');
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(menuItems[1]);
  });

  it('ArrowDown wraps from last to first', () => {
    renderMenu();
    flushRaf();
    const menuItems = screen.getAllByRole('menuitem');
    fireEvent.keyDown(document, { key: 'ArrowDown' }); // → index 1
    fireEvent.keyDown(document, { key: 'ArrowDown' }); // → index 2
    fireEvent.keyDown(document, { key: 'ArrowDown' }); // → wraps to 0
    expect(document.activeElement).toBe(menuItems[0]);
  });

  it('ArrowUp moves focus to the previous item', () => {
    renderMenu();
    flushRaf();
    const menuItems = screen.getAllByRole('menuitem');
    fireEvent.keyDown(document, { key: 'ArrowDown' }); // → index 1
    fireEvent.keyDown(document, { key: 'ArrowUp' });   // → index 0
    expect(document.activeElement).toBe(menuItems[0]);
  });

  it('ArrowUp wraps from first to last', () => {
    renderMenu();
    flushRaf();
    const menuItems = screen.getAllByRole('menuitem');
    // starts at 0, ArrowUp should wrap to last (index 2)
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(menuItems[2]);
  });

  it('Home focuses the first item', () => {
    renderMenu();
    flushRaf();
    const menuItems = screen.getAllByRole('menuitem');
    fireEvent.keyDown(document, { key: 'ArrowDown' }); // move away
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Home' });
    expect(document.activeElement).toBe(menuItems[0]);
  });

  it('End focuses the last item', () => {
    renderMenu();
    flushRaf();
    const menuItems = screen.getAllByRole('menuitem');
    fireEvent.keyDown(document, { key: 'End' });
    expect(document.activeElement).toBe(menuItems[2]);
  });

  it('Escape calls onDismiss', () => {
    const { onDismiss } = renderMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('clicking an item calls its onClick and onDismiss', () => {
    const { onDismiss } = renderMenu();
    const menuItems = screen.getAllByRole('menuitem');
    fireEvent.click(menuItems[1]);
    expect(items[1].onClick).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('clicking outside the menu calls onDismiss', () => {
    const { onDismiss } = renderMenu();
    fireEvent.mouseDown(document.body);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('renders a title when provided', () => {
    renderMenu({ title: 'Farm Actions' });
    expect(screen.getByText('Farm Actions')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    renderMenu({ open: false });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('menuitem')).toBeNull();
  });
});
