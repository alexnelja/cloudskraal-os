import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import { WIKI_CATEGORIES } from '../../types/wiki';

interface MiniNode extends SimulationNodeDatum {
  id: string;
  slug: string;
  title: string;
  category: string;
  isCurrent: boolean;
}

interface MiniEdge extends SimulationLinkDatum<MiniNode> {
  source: string | MiniNode;
  target: string | MiniNode;
}

interface WikiMiniGraphProps {
  currentSlug: string;
  currentTitle: string;
  currentCategory: string;
  outgoingLinks: { slug: string; title: string }[];
  backlinks: { slug: string; title: string }[];
}

export default function WikiMiniGraph({
  currentSlug,
  currentTitle,
  currentCategory,
  outgoingLinks,
  backlinks,
}: WikiMiniGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const nodesRef = useRef<MiniNode[]>([]);

  const totalLinks = outgoingLinks.length + backlinks.length;
  if (totalLinks === 0) return null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.offsetWidth;
    const height = 160;
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    // Build nodes — current page + all connected pages
    const nodeMap = new Map<string, MiniNode>();
    nodeMap.set(currentSlug, {
      id: currentSlug,
      slug: currentSlug,
      title: currentTitle,
      category: currentCategory,
      isCurrent: true,
    });

    for (const link of [...outgoingLinks, ...backlinks]) {
      if (!nodeMap.has(link.slug)) {
        nodeMap.set(link.slug, {
          id: link.slug,
          slug: link.slug,
          title: link.title,
          category: '',
          isCurrent: false,
        });
      }
    }

    const nodes = Array.from(nodeMap.values());
    nodesRef.current = nodes;

    const edges: MiniEdge[] = [];
    for (const link of outgoingLinks) {
      edges.push({ source: currentSlug, target: link.slug });
    }
    for (const link of backlinks) {
      edges.push({ source: link.slug, target: currentSlug });
    }

    const sim = forceSimulation<MiniNode>(nodes)
      .force('link', forceLink<MiniNode, MiniEdge>(edges).id(d => d.id).distance(50))
      .force('charge', forceManyBody().strength(-80))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide(16));

    sim.on('tick', () => {
      ctx.clearRect(0, 0, width, height);

      // Draw edges
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 1;
      for (const edge of edges) {
        const source = edge.source as MiniNode;
        const target = edge.target as MiniNode;
        if (source.x == null || target.x == null) continue;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y!);
        ctx.lineTo(target.x, target.y!);
        ctx.stroke();
      }

      // Draw nodes
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        const r = node.isCurrent ? 8 : 5;
        const color = node.isCurrent
          ? (WIKI_CATEGORIES[node.category]?.color ?? '#047857')
          : '#9ca3af';

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (node.isCurrent) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = node.isCurrent ? '#1c1917' : '#78716c';
        ctx.font = node.isCurrent ? 'bold 9px system-ui' : '8px system-ui';
        ctx.textAlign = 'center';
        const label = node.title.length > 18 ? node.title.slice(0, 16) + '...' : node.title;
        ctx.fillText(label, node.x, node.y + r + 10);
      }
    });

    // Stop after settling
    setTimeout(() => sim.stop(), 2000);

    return () => { sim.stop(); };
  }, [currentSlug, currentTitle, currentCategory, outgoingLinks, backlinks]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (const node of nodesRef.current) {
      if (node.x == null || node.y == null) continue;
      const dx = node.x - x;
      const dy = node.y! - y;
      if (dx * dx + dy * dy < 100) {
        if (!node.isCurrent) {
          navigate(`/wiki/${node.slug}`);
        }
        return;
      }
    }
  }

  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
        Local Graph
      </h3>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="w-full rounded-lg bg-stone-50 cursor-pointer"
        style={{ height: 160 }}
      />
    </div>
  );
}
