import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnotationsSidebar from './AnnotationsSidebar';
import type { Annotation } from '../../types/annotation';
import type { Measurement } from '../../types/measurement';
import * as measurementsApi from '../../api/measurements';

vi.mock('../../api/measurements');

function makeAnn(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'a1',
    type: 'pin',
    title: 'Gate',
    notes: null,
    geometry_json: '{}',
    geometry: { type: 'Point', coordinates: [0, 0] },
    length_m: null,
    area_m2: null,
    field_id: null,
    farm_id: null,
    created_at: '2026-04-15T00:00:00Z',
    updated_at: '2026-04-15T00:00:00Z',
    category: null,
    metadata: null,
    ...overrides,
  };
}

const items: Annotation[] = [
  makeAnn({ id: 'a1', type: 'pin', title: 'Gate' }),
  makeAnn({ id: 'a2', type: 'line', title: 'Fence', length_m: 250 }),
  makeAnn({ id: 'a3', type: 'polygon', title: 'Patch', area_m2: 15_000 }),
];

function renderSidebar(overrides: Partial<React.ComponentProps<typeof AnnotationsSidebar>> = {}) {
  const props = {
    open: true,
    annotations: items,
    selectedId: null as string | null,
    onToggle: vi.fn(),
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  return { ...props, ...render(<AnnotationsSidebar {...props} />) };
}

function makeMeasurement(overrides: Partial<Measurement> = {}): Measurement {
  return {
    id: 'm1',
    name: 'Fence line',
    kind: 'length',
    value: 1230,
    unit: 'm',
    formatted: '1.23 km',
    geometry: '{"type":"LineString","coordinates":[[0,0],[1,1]]}',
    field_id: null,
    notes: null,
    created_at: '2026-04-15T00:00:00Z',
    ...overrides,
  };
}

describe('AnnotationsSidebar', () => {
  beforeEach(() => {
    cleanup();
    vi.mocked(measurementsApi.listMeasurements).mockResolvedValue([]);
    vi.mocked(measurementsApi.deleteMeasurement).mockResolvedValue(undefined);
  });

  it('renders count badge equal to items length', () => {
    renderSidebar();
    expect(screen.getByTestId('annotation-count').textContent).toBe('3');
  });

  it('shows all annotations as rows', () => {
    renderSidebar();
    expect(screen.getByText('Gate')).toBeInTheDocument();
    expect(screen.getByText('Fence')).toBeInTheDocument();
    expect(screen.getByText('Patch')).toBeInTheDocument();
  });

  it('clicking a row fires onSelect with the id', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderSidebar({ onSelect });
    await user.click(screen.getByText('Fence'));
    expect(onSelect).toHaveBeenCalledWith('a2');
  });

  it('filter chip "Pins" hides line and polygon rows', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole('button', { name: /pins/i }));
    expect(screen.getByText('Gate')).toBeInTheDocument();
    expect(screen.queryByText('Fence')).not.toBeInTheDocument();
    expect(screen.queryByText('Patch')).not.toBeInTheDocument();
  });

  it('empty state renders when no annotations', () => {
    renderSidebar({ annotations: [] });
    expect(screen.getByText(/no annotations/i)).toBeInTheDocument();
  });

  it('delete button fires onDelete after confirmation', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSidebar({ onDelete });
    const row = screen.getByText('Gate').closest('[data-annotation-row]')!;
    await user.click(within(row as HTMLElement).getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith('a1');
    confirmSpy.mockRestore();
  });

  it('delete does nothing if confirmation is dismissed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderSidebar({ onDelete });
    const row = screen.getByText('Gate').closest('[data-annotation-row]')!;
    await user.click(within(row as HTMLElement).getByRole('button', { name: /delete/i }));
    expect(onDelete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('renders nothing when open=false', () => {
    const { container } = renderSidebar({ open: false });
    expect(container.firstChild).toBeNull();
  });

  it('line row shows formatted length', () => {
    renderSidebar();
    expect(screen.getByText(/250 m/)).toBeInTheDocument();
  });

  it('polygon row shows formatted area', () => {
    renderSidebar();
    expect(screen.getByText(/1\.50 ha/)).toBeInTheDocument();
  });

  it('highlights the selected row', () => {
    renderSidebar({ selectedId: 'a2' });
    const fenceRow = screen.getByText('Fence').closest('[data-annotation-row]')!;
    expect(fenceRow).toHaveAttribute('data-selected', 'true');
  });
});

describe('AnnotationsSidebar — Measurements tab', () => {
  beforeEach(() => {
    cleanup();
    vi.mocked(measurementsApi.deleteMeasurement).mockResolvedValue(undefined);
  });

  it('shows Measurements tab', async () => {
    vi.mocked(measurementsApi.listMeasurements).mockResolvedValue([makeMeasurement()]);
    render(
      <AnnotationsSidebar
        open={true}
        annotations={[]}
        selectedId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /measurements/i })).toBeInTheDocument();
  });

  it('displays measurement rows when Measurements tab is active', async () => {
    const user = userEvent.setup();
    vi.mocked(measurementsApi.listMeasurements).mockResolvedValue([makeMeasurement()]);
    render(
      <AnnotationsSidebar
        open={true}
        annotations={[]}
        selectedId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /measurements/i }));
    await waitFor(() => {
      expect(screen.getByText('Fence line')).toBeInTheDocument();
      expect(screen.getByText('1.23 km')).toBeInTheDocument();
    });
  });

  it('delete button removes measurement row', async () => {
    const user = userEvent.setup();
    vi.mocked(measurementsApi.listMeasurements).mockResolvedValue([makeMeasurement()]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <AnnotationsSidebar
        open={true}
        annotations={[]}
        selectedId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /measurements/i }));
    await waitFor(() => expect(screen.getByText('Fence line')).toBeInTheDocument());
    const row = screen.getByText('Fence line').closest('[data-measurement-row]')!;
    await user.click(within(row as HTMLElement).getByRole('button', { name: /delete/i }));
    expect(measurementsApi.deleteMeasurement).toHaveBeenCalledWith('m1');
    confirmSpy.mockRestore();
  });

  it('copy button writes formatted to clipboard', async () => {
    const user = userEvent.setup();
    vi.mocked(measurementsApi.listMeasurements).mockResolvedValue([makeMeasurement()]);
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(
      <AnnotationsSidebar
        open={true}
        annotations={[]}
        selectedId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /measurements/i }));
    await waitFor(() => expect(screen.getByText('Fence line')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeSpy).toHaveBeenCalledWith('1.23 km');
    writeSpy.mockRestore();
  });

  it('clicking measurement row name/value area fires onMeasurementZoom with the measurement (Fix 2)', async () => {
    const user = userEvent.setup();
    const measurement = makeMeasurement();
    vi.mocked(measurementsApi.listMeasurements).mockResolvedValue([measurement]);
    const onMeasurementZoom = vi.fn();
    render(
      <AnnotationsSidebar
        open={true}
        annotations={[]}
        selectedId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onMeasurementZoom={onMeasurementZoom}
      />,
    );
    await user.click(screen.getByRole('button', { name: /measurements/i }));
    await waitFor(() => expect(screen.getByText('Fence line')).toBeInTheDocument());

    // Click the zoom button (name area)
    await user.click(screen.getByRole('button', { name: /zoom to fence line/i }));
    expect(onMeasurementZoom).toHaveBeenCalledTimes(1);
    expect(onMeasurementZoom).toHaveBeenCalledWith(measurement);
  });

  it('clicking Delete button does NOT fire onMeasurementZoom (Fix 2)', async () => {
    const user = userEvent.setup();
    const measurement = makeMeasurement();
    vi.mocked(measurementsApi.listMeasurements).mockResolvedValue([measurement]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onMeasurementZoom = vi.fn();
    render(
      <AnnotationsSidebar
        open={true}
        annotations={[]}
        selectedId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onMeasurementZoom={onMeasurementZoom}
      />,
    );
    await user.click(screen.getByRole('button', { name: /measurements/i }));
    await waitFor(() => expect(screen.getByText('Fence line')).toBeInTheDocument());
    const row = screen.getByText('Fence line').closest('[data-measurement-row]')!;
    await user.click(within(row as HTMLElement).getByRole('button', { name: /delete/i }));
    expect(onMeasurementZoom).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('clicking Copy button does NOT fire onMeasurementZoom (Fix 2)', async () => {
    const user = userEvent.setup();
    const measurement = makeMeasurement();
    vi.mocked(measurementsApi.listMeasurements).mockResolvedValue([measurement]);
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const onMeasurementZoom = vi.fn();
    render(
      <AnnotationsSidebar
        open={true}
        annotations={[]}
        selectedId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onMeasurementZoom={onMeasurementZoom}
      />,
    );
    await user.click(screen.getByRole('button', { name: /measurements/i }));
    await waitFor(() => expect(screen.getByText('Fence line')).toBeInTheDocument());
    const row = screen.getByText('Fence line').closest('[data-measurement-row]')!;
    await user.click(within(row as HTMLElement).getByRole('button', { name: /copy/i }));
    expect(onMeasurementZoom).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });
});
