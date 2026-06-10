// Spec 2h.2 — the cost build-up node map. Deterministic left→right layered
// DAG (leaves → layer groups → total → ÷yield → cost/kg; price → margin),
// rendered as plain SVG. Clicking an editable node opens the what-if editor;
// what-if values render in amber with a delta badge.
import { useMemo } from 'react';
import type { CostNodeMap, CostMapNode } from '../../types/costMap';
import type { WhatIfOverrides, WhatIfResult } from '../../lib/costMapWhatIf';

export const LAYER_COLORS: Record<string, string> = {
  direct_inputs: '#059669', // emerald — the 2a base
  labour: '#0d9488',        // teal
  shared: '#65a30d',        // lime
  activities: '#d97706',    // amber — machines & diesel
  overhead: '#7c3aed',      // violet
  capital: '#0369a1',       // sky
  processing: '#b45309',    // bronze
};

const COL_X = { leaf: 24, layer: 264, total: 520, unit: 700, margin: 880 };
const NODE_W = { leaf: 200, layer: 210, kpi: 150 };
const ROW_H = 46;
const LAYER_GAP = 14;

interface Pos { x: number; y: number; w: number; h: number }

function fmtR(v: number | null | undefined, suffix = ''): string {
  if (v == null) return '—';
  return `R ${v.toLocaleString('en-ZA', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}${suffix}`;
}

interface Props {
  map: CostNodeMap;
  overrides: WhatIfOverrides;
  whatIf: WhatIfResult;
  onNodeClick: (node: CostMapNode) => void;
  onToggleLayer: (flag: string) => void;
}

export default function CostNodeMapView({ map, overrides, whatIf, onNodeClick, onToggleLayer }: Props) {
  const { positions, height } = useMemo(() => {
    const pos = new Map<string, Pos>();
    let y = 16;
    const layers = map.nodes.filter(n => n.kind === 'layer');
    for (const layer of layers) {
      const leaves = layer.status === 'ok'
        ? map.nodes.filter(n => n.kind === 'leaf' && n.layer === layer.layer)
        : [];
      const blockH = Math.max(ROW_H, leaves.length * ROW_H);
      for (let i = 0; i < leaves.length; i++) {
        pos.set(leaves[i].id, { x: COL_X.leaf, y: y + i * ROW_H, w: NODE_W.leaf, h: ROW_H - 10 });
      }
      pos.set(layer.id, { x: COL_X.layer, y: y + blockH / 2 - (ROW_H - 10) / 2, w: NODE_W.layer, h: ROW_H - 10 });
      y += blockH + LAYER_GAP;
    }
    const mid = Math.max(140, y / 2 - 40);
    pos.set('total', { x: COL_X.total, y: mid - 56, w: NODE_W.kpi, h: 52 });
    pos.set('yield', { x: COL_X.total, y: mid + 16, w: NODE_W.kpi, h: 44 });
    pos.set('unit_cost', { x: COL_X.unit, y: mid - 26, w: NODE_W.kpi, h: 58 });
    pos.set('price', { x: COL_X.margin, y: mid - 64, w: NODE_W.kpi, h: 44 });
    pos.set('margin', { x: COL_X.margin, y: mid + 4, w: NODE_W.kpi, h: 52 });
    return { positions: pos, height: Math.max(y + 16, mid + 110) };
  }, [map]);

  const edgePath = (s: Pos, t: Pos) => {
    const x1 = s.x + s.w, y1 = s.y + s.h / 2, x2 = t.x, y2 = t.y + t.h / 2;
    const c = (x2 - x1) / 2;
    return `M ${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`;
  };

  const overridden = (id: string) => overrides[id] != null;

  return (
    <svg
      viewBox={`0 0 1056 ${height}`}
      className="w-full"
      style={{ minHeight: 360 }}
      role="img"
      aria-label="Cost build-up node map"
      data-testid="cost-node-map"
    >
      {/* edges */}
      {map.edges.map((e, i) => {
        const s = positions.get(e.source);
        const t = positions.get(e.target);
        if (!s || !t) return null;
        const srcNode = map.nodes.find(n => n.id === e.source);
        const color = srcNode?.layer ? LAYER_COLORS[srcNode.layer] : '#a8a29e';
        return (
          <path key={i} d={edgePath(s, t)} fill="none" stroke={color}
            strokeWidth={srcNode?.kind === 'layer' || srcNode?.kind === 'total' ? 2.5 : 1.25}
            strokeOpacity={0.45} />
        );
      })}

      {/* nodes */}
      {map.nodes.map(node => {
        const p = positions.get(node.id);
        if (!p) return null;
        const isLayer = node.kind === 'layer';
        const color = node.layer ? LAYER_COLORS[node.layer] : '#44403c';
        const off = node.status === 'off';
        const noData = node.status === 'no_data';
        const isOverridden = overridden(node.id)
          || (node.id === 'yield' && overridden('yield'))
          || (node.id === 'price' && overridden('price'));

        let display: string;
        if (node.kind === 'leaf' || isLayer) {
          const v = isLayer && node.layer && node.status === 'ok'
            ? whatIf.layerValues[node.layer] ?? node.value_zar
            : overrides[node.id] ?? node.value_zar;
          display = off ? 'off' : noData ? 'no data' : fmtR(v ?? null);
        } else if (node.id === 'total') display = fmtR(whatIf.total);
        else if (node.id === 'yield') display = `${(overrides['yield'] ?? node.value_kg ?? 0).toLocaleString('en-ZA')} kg`;
        else if (node.id === 'unit_cost') display = fmtR(whatIf.unitCost, '/kg');
        else if (node.id === 'price') display = fmtR(whatIf.pricePerKg, '/kg');
        else display = fmtR(whatIf.marginPerKg, '/kg');

        const marginNeg = node.id === 'margin' && (whatIf.marginPerKg ?? 0) < 0;
        const clickable = !off && (node.kind === 'leaf' || (isLayer && node.status === 'ok')
          || node.id === 'yield' || node.id === 'price');

        return (
          <g key={node.id}
            data-testid={`node-${node.id}`}
            onClick={() => {
              if (isLayer && (off || noData) && node.include_flag) onToggleLayer(node.include_flag);
              else if (clickable) onNodeClick(node);
            }}
            style={{ cursor: clickable || (isLayer && node.include_flag) ? 'pointer' : 'default' }}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={10}
              fill={off || noData ? 'transparent' : node.kind === 'leaf' ? '#fafaf9' : 'white'}
              stroke={isOverridden ? '#d97706' : marginNeg ? '#dc2626' : isLayer || node.kind === 'leaf' ? color : '#d6d3d1'}
              strokeWidth={isLayer || ['total', 'unit_cost', 'margin'].includes(node.id) ? 2 : 1.2}
              strokeDasharray={off || noData ? '5 4' : undefined}
              opacity={off ? 0.55 : 1}
            />
            {isLayer && !off && !noData && (
              <rect x={p.x} y={p.y} width={5} height={p.h} rx={2.5} fill={color} />
            )}
            <text x={p.x + 12} y={p.y + p.h / 2 - 4} fontSize={11}
              fill={off ? '#a8a29e' : '#57534e'} fontWeight={isLayer ? 600 : 400}>
              {node.label.length > 30 ? node.label.slice(0, 29) + '…' : node.label}
              {off && node.data_exists ? ' •' : ''}
            </text>
            <text x={p.x + 12} y={p.y + p.h / 2 + 12} fontSize={isLayer || node.kind !== 'leaf' ? 13 : 12}
              fontWeight={600}
              fill={off || noData ? '#a8a29e'
                : isOverridden ? '#d97706'
                : marginNeg ? '#dc2626'
                : node.id === 'margin' ? '#047857'
                : '#1c1917'}>
              {display}
            </text>
            {noData && node.hint && (
              <title>{node.hint}</title>
            )}
            {off && (
              <title>{node.data_exists ? 'Layer off — data exists. Click to enable.' : 'Layer off. Click to enable.'}</title>
            )}
          </g>
        );
      })}
    </svg>
  );
}
