import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ExportMapButton from './ExportMapButton';

function makeMockMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,MOCK');

  let renderCb: (() => void) | null = null;
  return {
    getCanvas: () => canvas,
    once: (_event: string, cb: () => void) => { renderCb = cb; },
    triggerRepaint: () => { renderCb?.(); },
  } as unknown as Parameters<typeof ExportMapButton>[0]['map'];
}

describe('ExportMapButton', () => {
  it('renders nothing when map is null', () => {
    const { container } = render(<ExportMapButton map={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders an export button when map is provided', () => {
    render(<ExportMapButton map={makeMockMap()} />);
    expect(screen.getByRole('button', { name: /export map/i })).toBeInTheDocument();
  });

  it('opens a dropdown with PNG and PDF options on click', () => {
    render(<ExportMapButton map={makeMockMap()} />);
    fireEvent.click(screen.getByRole('button', { name: /export map/i }));
    expect(screen.getByText(/download png/i)).toBeInTheDocument();
    expect(screen.getByText(/print.*pdf/i)).toBeInTheDocument();
  });

  it('triggers PNG download when Download PNG is clicked', async () => {
    const map = makeMockMap();
    const originalCreate = document.createElement.bind(document);
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = originalCreate('a');
        el.click = clickSpy;
        return el;
      }
      return originalCreate(tag);
    });

    render(<ExportMapButton map={map} />);
    fireEvent.click(screen.getByRole('button', { name: /export map/i }));
    fireEvent.click(screen.getByText(/download png/i));

    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    vi.restoreAllMocks();
  });
});
