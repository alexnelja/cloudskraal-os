import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import QuickAddFAB from './QuickAddFAB';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function renderFab() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="*" element={<><QuickAddFAB /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('QuickAddFAB', () => {
  it('shows Drop map note as an action when the menu opens', () => {
    renderFab();
    fireEvent.click(screen.getByLabelText(/open quick add menu/i));
    expect(screen.getByText(/drop map note/i)).toBeInTheDocument();
  });

  it('navigates to /map with armNote=1 when Drop map note is clicked', () => {
    renderFab();
    fireEvent.click(screen.getByLabelText(/open quick add menu/i));
    fireEvent.click(screen.getByText(/drop map note/i));
    expect(screen.getByTestId('loc').textContent).toBe('/map?armNote=1');
  });

  it('still offers the legacy actions (New Wiki Page, New Task)', () => {
    renderFab();
    fireEvent.click(screen.getByLabelText(/open quick add menu/i));
    expect(screen.getByText(/new wiki page/i)).toBeInTheDocument();
    expect(screen.getByText(/new task/i)).toBeInTheDocument();
  });

  it('closed FAB renders with glass background and no linear-gradient', () => {
    render(
      <MemoryRouter>
        <QuickAddFAB />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: /open quick add menu/i });
    expect(button.style.background).not.toMatch(/linear-gradient/);
    expect(button.style.background).toMatch(/var\(--glass-bg\)|rgba\(255,\s*255,\s*255/);
  });

  it('open FAB also uses glass surface (no dark gradient swap)', () => {
    render(
      <MemoryRouter>
        <QuickAddFAB />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: /open quick add menu/i });
    fireEvent.click(button);
    const close = screen.getByRole('button', { name: /close quick add menu/i });
    expect(close.style.background).not.toMatch(/linear-gradient/);
  });

  it('plus icon has emerald-700 colour class', () => {
    render(
      <MemoryRouter>
        <QuickAddFAB />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: /open quick add menu/i });
    const icon = button.querySelector('svg');
    expect(icon).not.toBeNull();
    // Icon uses className so we check the rendered class
    expect(icon!.getAttribute('class') || '').toMatch(/text-emerald-700/);
  });
});
