/**
 * FarmMapPage — Fix 2: polygon-first field creation
 *
 * FarmMapPage imports maplibre-gl which requires canvas/WebGL and cannot be
 * rendered in jsdom. These tests exercise the awaitingFieldDraw state logic
 * via a minimal harness that mirrors the exact state machine used in the page,
 * without importing the page component itself.
 *
 * Verified behaviours:
 * 1. ADD button handler (no pre-supplied geometry) arms polygon draw mode via
 *    terraDraw.setMode('render') → setMode('polygon').
 * 2. handleDrawFinish with a Polygon while awaitingFieldDraw=true opens
 *    NewFieldModal pre-filled with geometry + computed area.
 * 3. handleDrawFinish with a non-polygon type while awaitingFieldDraw=true
 *    does NOT open the modal (falls through to the save-as chooser path).
 * 4. handleDrawFinish with a Polygon while awaitingFieldDraw=false also does
 *    NOT open the modal (normal measure path).
 */
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState, useCallback, useRef } from 'react';
import * as turf from '@turf/turf';

// ── Minimal harness that mirrors the FarmMapPage state machine ───────────────

interface TerraDraw { setMode: (mode: string) => void }

interface DrawFinishPayload {
  type: string;
  geometry: GeoJSON.Geometry;
}

function FieldDrawHarness({
  terraDraw,
  onFinishedGeometry,
}: {
  terraDraw: TerraDraw | null;
  onFinishedGeometry?: (geom: GeoJSON.Geometry | null) => void;
}) {
  const [awaitingFieldDraw, setAwaitingFieldDraw] = useState(false);
  const awaitingFieldDrawRef = useRef(false);
  awaitingFieldDrawRef.current = awaitingFieldDraw;

  const [newFieldOpen, setNewFieldOpen] = useState(false);
  const [newFieldSeed, setNewFieldSeed] = useState<{ geometry?: GeoJSON.Geometry; areaHa?: number }>({});
  const [finishedGeometry, setFinishedGeometry] = useState<GeoJSON.Geometry | null>(null);

  // Mirror of FarmMapPage.handleAddField
  const handleAddField = useCallback(() => {
    if (terraDraw) {
      terraDraw.setMode('render');
      terraDraw.setMode('polygon');
    }
    setAwaitingFieldDraw(true);
  }, [terraDraw]);

  // Mirror of FarmMapPage.handleDrawFinish (Fix 2 branch)
  const handleDrawFinish = useCallback((payload: DrawFinishPayload) => {
    if (awaitingFieldDrawRef.current && payload.geometry.type === 'Polygon') {
      let areaHa: number | undefined;
      try {
        areaHa = turf.area(turf.feature(payload.geometry)) / 10000;
      } catch { /* ignore */ }
      setNewFieldSeed({ geometry: payload.geometry, areaHa });
      setNewFieldOpen(true);
      setAwaitingFieldDraw(false);
      return;
    }
    // Normal path: capture for save-as chooser
    setFinishedGeometry(payload.geometry);
    onFinishedGeometry?.(payload.geometry);
  }, [onFinishedGeometry]);

  return (
    <div>
      <button data-testid="add-btn" onClick={handleAddField}>Add Field</button>
      <button
        data-testid="draw-finish-poly"
        onClick={() =>
          handleDrawFinish({
            type: 'polygon',
            geometry: {
              type: 'Polygon',
              coordinates: [[[19, -33], [19.01, -33], [19.01, -33.01], [19, -33.01], [19, -33]]],
            },
          })
        }
      >
        Finish Polygon
      </button>
      <button
        data-testid="draw-finish-line"
        onClick={() =>
          handleDrawFinish({
            type: 'line',
            geometry: { type: 'LineString', coordinates: [[19, -33], [19.01, -33]] },
          })
        }
      >
        Finish Line
      </button>
      {awaitingFieldDraw && <div data-testid="await-banner">Draw boundary</div>}
      {finishedGeometry && <div data-testid="chooser-open">chooser</div>}
      {newFieldOpen && (
        <div data-testid="new-field-modal">
          <span data-testid="nfm-geometry">{JSON.stringify(newFieldSeed.geometry)}</span>
          <span data-testid="nfm-area">{newFieldSeed.areaHa?.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}

const mockSetMode = vi.fn();
const mockTerraDraw: TerraDraw = { setMode: mockSetMode };

describe('FarmMapPage — Fix 2: polygon-first field creation (logic harness)', () => {
  beforeEach(() => {
    mockSetMode.mockClear();
  });

  it('ADD handler calls setMode(render) then setMode(polygon) and shows draw banner', async () => {
    render(<FieldDrawHarness terraDraw={mockTerraDraw} />);

    await act(async () => {
      screen.getByTestId('add-btn').click();
    });

    expect(mockSetMode).toHaveBeenNthCalledWith(1, 'render');
    expect(mockSetMode).toHaveBeenNthCalledWith(2, 'polygon');
    expect(mockSetMode).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('await-banner')).toBeInTheDocument();
  });

  it('draw finish with Polygon while awaitingFieldDraw opens modal pre-filled with geometry + area', async () => {
    render(<FieldDrawHarness terraDraw={mockTerraDraw} />);

    // Arm
    await act(async () => { screen.getByTestId('add-btn').click(); });
    // Finish polygon draw
    await act(async () => { screen.getByTestId('draw-finish-poly').click(); });

    expect(screen.getByTestId('new-field-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('await-banner')).not.toBeInTheDocument();

    const geomText = screen.getByTestId('nfm-geometry').textContent;
    expect(JSON.parse(geomText!)).toMatchObject({ type: 'Polygon' });

    const area = parseFloat(screen.getByTestId('nfm-area').textContent!);
    expect(area).toBeGreaterThan(0);
  });

  it('draw finish with LineString while awaitingFieldDraw falls through to chooser path (no modal)', async () => {
    const onFinished = vi.fn();
    render(<FieldDrawHarness terraDraw={mockTerraDraw} onFinishedGeometry={onFinished} />);

    // Arm
    await act(async () => { screen.getByTestId('add-btn').click(); });
    // Finish a line (wrong type)
    await act(async () => { screen.getByTestId('draw-finish-line').click(); });

    // Modal must NOT open — falls to the save-as chooser path
    expect(screen.queryByTestId('new-field-modal')).not.toBeInTheDocument();
    // finishedGeometry should be set (chooser path)
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LineString' }),
    );
  });

  it('draw finish with Polygon when NOT awaiting field draw goes to save-as chooser path', async () => {
    const onFinished = vi.fn();
    render(<FieldDrawHarness terraDraw={mockTerraDraw} onFinishedGeometry={onFinished} />);

    // Do NOT click ADD — awaitingFieldDraw stays false
    await act(async () => { screen.getByTestId('draw-finish-poly').click(); });

    // Modal must NOT open — not in awaiting mode
    expect(screen.queryByTestId('new-field-modal')).not.toBeInTheDocument();
    // Normal path fires
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Polygon' }),
    );
  });
});
