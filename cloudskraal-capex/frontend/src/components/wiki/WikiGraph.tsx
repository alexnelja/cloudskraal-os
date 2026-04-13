import { useEffect, useRef, useState, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import { getWikiGraph } from '../../api/wiki';
import { WIKI_CATEGORIES } from '../../types/wiki';

type ThemeMode = 'light' | 'dark' | 'system';

interface WikiGraphProps {
  onPageSelect: (slug: string) => void;
  onNodePreview?: (slug: string, position: { x: number; y: number }) => void;
  highlightSlug?: string | null;
  theme?: ThemeMode;
  forceStrength?: number;
  linkDistance?: number;
  nodeScale?: number;
}

interface GraphNode extends SimulationNodeDatum {
  id: string;
  slug: string;
  title: string;
  category: string;
  enterprise: string;
  linkCount: number;
  radius: number;
}

interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface TooltipState {
  x: number;
  y: number;
  node: GraphNode;
}

function nodeRadius(linkCount: number): number {
  return Math.min(20, Math.max(6, 6 + linkCount * 2));
}

function nodeColor(category: string): string {
  return WIKI_CATEGORIES[category]?.color ?? '#9ca3af';
}

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
}

export default function WikiGraph({ onPageSelect, onNodePreview, highlightSlug, theme = 'system', forceStrength = 300, linkDistance = 80, nodeScale = 1 }: WikiGraphProps) {
  const systemDark = useSystemDark();
  const isDark = theme === 'dark' || (theme === 'system' && systemDark);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const dragNodeRef = useRef<GraphNode | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  // Pan/zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number }>({ x: 0, y: 0, tx: 0, ty: 0 });

  // Track render tick
  const [tick, setTick] = useState(0);

  // Measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    ro.observe(container);
    const rect = container.getBoundingClientRect();
    if (rect.width > 0) setDimensions({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, []);

  // Load data + init simulation
  useEffect(() => {
    setLoading(true);
    getWikiGraph()
      .then((data) => {
        const nodes: GraphNode[] = data.nodes.map((n) => ({
          ...n,
          radius: nodeRadius(n.linkCount) * nodeScale,
        }));
        const edges: GraphEdge[] = data.edges.map((e) => ({ ...e }));

        nodesRef.current = nodes;
        edgesRef.current = edges;

        const sim = forceSimulation<GraphNode>(nodes)
          .force(
            'link',
            forceLink<GraphNode, GraphEdge>(edges)
              .id((d) => d.id)
              .distance(linkDistance),
          )
          .force('charge', forceManyBody<GraphNode>().strength(-forceStrength))
          .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
          .force('collide', forceCollide<GraphNode>().radius((d) => d.radius + 6));

        sim.on('tick', () => {
          setTick((t) => t + 1);
        });

        simRef.current = sim;
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load wiki graph:', err);
        setError('Failed to load graph data.');
        setLoading(false);
      });

    return () => {
      simRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center simulation when dimensions change
  useEffect(() => {
    if (!simRef.current) return;
    simRef.current
      .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
      .alpha(0.3)
      .restart();
  }, [dimensions]);

  // --- Drag handlers ---
  const getSVGPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: (clientX - rect.left - transform.x) / transform.k,
        y: (clientY - rect.top - transform.y) / transform.k,
      };
    },
    [transform],
  );

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, node: GraphNode) => {
      e.stopPropagation();
      dragNodeRef.current = node;
      const pt = getSVGPoint(e.clientX, e.clientY);
      dragOffsetRef.current = { x: pt.x - (node.x ?? 0), y: pt.y - (node.y ?? 0) };
      node.fx = node.x;
      node.fy = node.y;
      simRef.current?.alphaTarget(0.3).restart();
    },
    [getSVGPoint],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragNodeRef.current) {
        const pt = getSVGPoint(e.clientX, e.clientY);
        dragNodeRef.current.fx = pt.x - dragOffsetRef.current.x;
        dragNodeRef.current.fy = pt.y - dragOffsetRef.current.y;
        simRef.current?.alpha(0.3).restart();
        return;
      }
      if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setTransform((t) => ({ ...t, x: panStartRef.current.tx + dx, y: panStartRef.current.ty + dy }));
      }
    },
    [getSVGPoint],
  );

  const handleMouseUp = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.fx = undefined;
      dragNodeRef.current.fy = undefined;
      dragNodeRef.current = null;
      simRef.current?.alphaTarget(0);
    }
    isPanningRef.current = false;
  }, []);

  const handleSVGMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).classList.contains('link')) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, tx: 0, ty: 0 };
      // capture current transform
      setTransform((t) => {
        panStartRef.current.tx = t.x;
        panStartRef.current.ty = t.y;
        return t;
      });
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => {
      const newK = Math.min(4, Math.max(0.2, t.k * delta));
      const svg = svgRef.current;
      if (!svg) return t;
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      // Zoom towards mouse pointer
      const newX = mouseX - ((mouseX - t.x) / t.k) * newK;
      const newY = mouseY - ((mouseY - t.y) / t.k) * newK;
      return { x: newX, y: newY, k: newK };
    });
  }, []);

  // Edge path: quadratic curve
  function edgePath(edge: GraphEdge): string {
    const s = edge.source as GraphNode;
    const t = edge.target as GraphNode;
    if (!s.x || !s.y || !t.x || !t.y) return '';
    const mx = (s.x + t.x) / 2;
    const my = (s.y + t.y) / 2;
    // Slight curve
    const dx = t.y - s.y;
    const dy = s.x - t.x;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const cx = mx + (dx / len) * 15;
    const cy = my + (dy / len) * 15;
    return `M ${s.x} ${s.y} Q ${cx} ${cy} ${t.x} ${t.y}`;
  }

  // Theme-aware colors
  const colors = isDark
    ? { bg: 'bg-stone-950', legendBg: 'bg-stone-900/90', legendBorder: 'border-stone-700', legendText: 'text-stone-300', hintText: 'text-stone-500', tooltipBg: 'bg-stone-900', tooltipBorder: 'border-stone-600', tooltipTitle: 'text-white', tooltipMeta: 'text-stone-400', tooltipSub: 'text-stone-500', edgeColor: '#44403c', nodeStroke: '#1c1917', labelFill: '#d6d3d1', divider: 'border-stone-700' }
    : { bg: 'bg-[#f3f4f3]', legendBg: 'bg-white/90 backdrop-blur-xl', legendBorder: 'border-[#bdc9c1]/15', legendText: 'text-stone-700', hintText: 'text-stone-400', tooltipBg: 'bg-white', tooltipBorder: 'border-[#bdc9c1]/30', tooltipTitle: 'text-stone-900', tooltipMeta: 'text-stone-500', tooltipSub: 'text-stone-400', edgeColor: '#bdc9c1', nodeStroke: '#ffffff', labelFill: '#44403c', divider: 'border-[#bdc9c1]/20' };

  if (loading) {
    return (
      <div ref={containerRef} className={`flex-1 flex items-center justify-center ${colors.bg}`}>
        <p className="text-stone-400 text-sm">Building graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} className={`flex-1 flex items-center justify-center ${colors.bg}`}>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  const nodes = nodesRef.current;
  const edges = edgesRef.current;

  return (
    <div
      ref={containerRef}
      className={`flex-1 relative overflow-hidden ${colors.bg} select-none`}
      style={{ cursor: isPanningRef.current ? 'grabbing' : 'grab' }}
    >
      {/* Legend */}
      <div className={`absolute top-3 right-3 z-10 ${colors.legendBg} border ${colors.legendBorder} rounded-2xl px-3 py-2.5 text-xs`}>
        {Object.entries(WIKI_CATEGORIES).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: val.color }} />
            <span className={colors.legendText}>{val.label}</span>
          </div>
        ))}
        <div className={`border-t ${colors.divider} mt-1.5 pt-1.5 ${colors.hintText}`}>
          Scroll to zoom · Drag to pan
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className={`absolute z-20 pointer-events-none ${colors.tooltipBg} border ${colors.tooltipBorder} rounded-2xl px-3 py-2 text-xs shadow-xl max-w-[220px]`}
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className={`font-semibold ${colors.tooltipTitle} truncate`}>{tooltip.node.title}</p>
          <p className={`${colors.tooltipMeta} mt-0.5`}>
            {WIKI_CATEGORIES[tooltip.node.category]?.label ?? tooltip.node.category}
          </p>
          <p className={`${colors.tooltipSub} mt-0.5`}>{tooltip.node.linkCount} link{tooltip.node.linkCount !== 1 ? 's' : ''}</p>
          <p className={`${colors.hintText} mt-1 text-[10px]`}>Click to preview</p>
        </div>
      )}

      {/* SVG */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
        onMouseDown={handleSVGMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Suppress unused tick warning */}
        {tick >= 0 && null}
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {/* Edges */}
          <g>
            {edges.map((edge, i) => {
              const s = edge.source as GraphNode;
              const t = edge.target as GraphNode;
              const isHighlighted =
                highlightSlug && (s.slug === highlightSlug || t.slug === highlightSlug);
              return (
                <path
                  key={i}
                  className="link"
                  d={edgePath(edge)}
                  fill="none"
                  stroke={isHighlighted ? '#d97706' : colors.edgeColor}
                  strokeWidth={isHighlighted ? 1.5 : 0.5}
                  strokeOpacity={isHighlighted ? 0.8 : isDark ? 0.5 : 0.4}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {nodes.map((node) => {
              const isHighlighted = highlightSlug === node.slug;
              const color = nodeColor(node.category);
              const showLabel = node.linkCount >= 3 || isHighlighted;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
                  style={{ cursor: 'pointer' }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onNodePreview) {
                      const rect = svgRef.current?.getBoundingClientRect();
                      if (rect) {
                        onNodePreview(node.slug, {
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                        });
                      }
                    } else {
                      onPageSelect(node.slug);
                    }
                  }}
                  onMouseEnter={(e) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        node,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Highlight ring */}
                  {isHighlighted && (
                    <circle
                      r={node.radius + 5}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      opacity={0.9}
                    />
                  )}
                  {/* Node circle */}
                  <circle
                    r={node.radius}
                    fill={color}
                    fillOpacity={0.85}
                    stroke={isHighlighted ? '#f59e0b' : colors.nodeStroke}
                    strokeWidth={isHighlighted ? 2 : isDark ? 1 : 1.5}
                  />
                  {/* Label */}
                  {showLabel && (
                    <text
                      dy="0.35em"
                      textAnchor="middle"
                      y={node.radius + 10}
                      fontSize={9}
                      fill={colors.labelFill}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {node.title.length > 18 ? node.title.slice(0, 16) + '…' : node.title}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
