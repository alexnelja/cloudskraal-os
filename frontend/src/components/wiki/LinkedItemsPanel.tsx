import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { LinkSimple } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../api/config';
import type { Task } from '../../api/tasks';
import type { Annotation } from '../../types/annotation';
import WikiTaskBlock from './WikiTaskBlock';
import WikiAnnotationBlock from './WikiAnnotationBlock';

interface Props {
  slug: string;
}

interface LinkedPayload {
  tasks: Task[];
  annotations: Annotation[];
}

export default function LinkedItemsPanel({ slug }: Props) {
  const [data, setData] = useState<LinkedPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE_URL}/wiki/${slug}/linked`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const tasks = data?.tasks ?? [];
  const annotations = data?.annotations ?? [];
  const isEmpty = tasks.length === 0 && annotations.length === 0;

  if (loading || isEmpty) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
      className="mt-10 pt-6 border-t border-stone-200/60"
    >
      <div className="flex items-center gap-2 mb-4">
        <LinkSimple size={16} weight="duotone" className="text-amber-700" />
        <h3 className="text-sm font-serif font-medium text-stone-800 tracking-tight">
          Linked items
        </h3>
        <span className="text-[11px] text-stone-500 font-mono">
          {tasks.length + annotations.length}
        </span>
      </div>

      {tasks.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-stone-500 mb-2">
            Tasks · {tasks.length}
          </p>
          <div className="space-y-2">
            {tasks.map((t) => (
              <WikiTaskBlock key={t.id} taskId={t.id} />
            ))}
          </div>
        </div>
      )}

      {annotations.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-stone-500 mb-2">
            Annotations · {annotations.length}
          </p>
          <div className="space-y-2">
            {annotations.map((a) => (
              <WikiAnnotationBlock key={a.id} annotationId={a.id} />
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}
