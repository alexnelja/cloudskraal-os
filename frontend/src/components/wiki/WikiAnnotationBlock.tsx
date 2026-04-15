import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowSquareOut } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../api/config';
import type { Annotation } from '../../types/annotation';
import { getCategoryDef } from '../map/annotationCategories';
import { formatDistance, formatArea } from '../map/tools/metricFormat';

interface Props {
  annotationId: string;
}

function metricFor(a: Annotation): string {
  if (a.type === 'line') return formatDistance(a.length_m);
  if (a.type === 'polygon') return formatArea(a.area_m2);
  return '';
}

export default function WikiAnnotationBlock({ annotationId }: Props) {
  const navigate = useNavigate();
  const [ann, setAnn] = useState<Annotation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/annotations/${annotationId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setAnn)
      .catch(() => setAnn(null))
      .finally(() => setLoading(false));
  }, [annotationId]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-stone-100/60 text-xs text-stone-400 animate-pulse my-1">
        Loading pin…
      </span>
    );
  }
  if (!ann) {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-stone-100 text-xs text-stone-500 my-1">
        Annotation unavailable
      </span>
    );
  }

  const def = getCategoryDef(ann.type, ann.category);
  const Icon = def.Icon;
  const metric = metricFor(ann);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="my-2 glass-panel rounded-xl p-3 flex items-start gap-3"
    >
      <span
        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-amber-700"
        style={{
          background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.9), rgba(253, 224, 155, 0.5))',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.75)',
        }}
      >
        <Icon size={18} weight="duotone" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-stone-900">{ann.title}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] uppercase tracking-wide text-stone-500">{def.label}</span>
          {metric && <span className="text-[11px] text-stone-600 font-mono">{metric}</span>}
          {ann.notes && (
            <span className="text-[11px] text-stone-500 truncate">· {ann.notes}</span>
          )}
        </div>
      </div>
      <motion.button
        type="button"
        onClick={() => navigate(`/map?annotation=${ann.id}`)}
        whileTap={{ scale: 0.92 }}
        whileHover={{ x: 1 }}
        className="shrink-0 inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 px-2 py-1 rounded-md hover:bg-amber-100/60"
      >
        View <ArrowSquareOut size={12} weight="bold" />
      </motion.button>
    </motion.div>
  );
}
