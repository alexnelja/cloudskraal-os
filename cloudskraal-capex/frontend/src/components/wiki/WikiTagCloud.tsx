import { useState, useEffect } from 'react';
import { Tag, ChevronDown, ChevronRight } from 'lucide-react';
import { getWikiTags } from '../../api/wiki';

interface WikiTagCloudProps {
  onTagSelect: (tag: string) => void;
}

export default function WikiTagCloud({ onTagSelect }: WikiTagCloudProps) {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded && tags.length === 0) {
      getWikiTags().then(setTags).catch(console.error);
    }
  }, [expanded]);

  const maxCount = Math.max(...tags.map(t => t.count), 1);

  return (
    <div className="px-2 py-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-1.5 px-1 py-1.5 text-stone-500 hover:text-stone-700 transition-colors rounded-md hover:bg-stone-50"
      >
        {expanded ? <ChevronDown size={12} className="text-stone-400" /> : <ChevronRight size={12} className="text-stone-400" />}
        <Tag size={13} className="text-stone-400" />
        <span className="text-xs font-semibold">Tags</span>
        {tags.length > 0 && <span className="text-[10px] text-stone-400 ml-auto">{tags.length}</span>}
      </button>

      {expanded && (
        <div className="px-2 pt-1 pb-2 flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const size = 10 + (t.count / maxCount) * 3;
            return (
              <button
                key={t.tag}
                onClick={() => onTagSelect(t.tag)}
                className="inline-block px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                style={{ fontSize: `${size}px` }}
                title={`${t.count} page${t.count > 1 ? 's' : ''}`}
              >
                {t.tag}
              </button>
            );
          })}
          {tags.length === 0 && (
            <p className="text-[10px] text-stone-400 px-1">No tags yet</p>
          )}
        </div>
      )}
    </div>
  );
}
