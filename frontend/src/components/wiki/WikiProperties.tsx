import { useState } from 'react';
import { Calendar, Tag, Building2, FolderOpen, Link2, Users, Plus, X } from 'lucide-react';
import { WIKI_CATEGORIES } from '../../types/wiki';
import { ENTERPRISE_LABELS } from '../../types/farm';
import type { WikiPage } from '../../types/wiki';

interface WikiPropertiesProps {
  page: WikiPage;
  onUpdateAliases?: (aliases: string[]) => void;
  onUpdateTags?: (tags: string[]) => void;
}

function PropertyRow({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <div className="flex items-center gap-1.5 w-20 flex-shrink-0 text-[11px] text-stone-500">
        <Icon size={12} className="text-stone-400" />
        <span>{label}</span>
      </div>
      <div className="flex-1 min-w-0 text-[12px] text-stone-800">{children}</div>
    </div>
  );
}

function EditableTagList({ items, onSave, color = 'stone' }: {
  items: string[];
  onSave: (items: string[]) => void;
  color?: 'stone' | 'blue';
}) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const bg = color === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-stone-100 text-stone-600';

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map((item) => (
        <span key={item} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 ${bg} text-[10px] font-medium rounded-full group`}>
          {item}
          <button onClick={() => onSave(items.filter(i => i !== item))} className="opacity-0 group-hover:opacity-100 transition-opacity">
            <X size={8} />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onBlur={() => {
            if (newValue.trim()) onSave([...items, newValue.trim()]);
            setNewValue('');
            setAdding(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newValue.trim()) {
              onSave([...items, newValue.trim()]);
              setNewValue('');
              setAdding(false);
            }
            if (e.key === 'Escape') { setNewValue(''); setAdding(false); }
          }}
          className="px-1.5 py-0.5 text-[10px] border border-stone-300 rounded-full w-20 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
          autoFocus
          placeholder="Add..."
        />
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center px-1 py-0.5 text-stone-400 hover:text-stone-600 transition-colors">
          <Plus size={10} />
        </button>
      )}
    </div>
  );
}

function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function WikiProperties({ page, onUpdateAliases, onUpdateTags }: WikiPropertiesProps) {
  const cat = page.category ? WIKI_CATEGORIES[page.category] : null;
  const entLabel = page.enterprise ? (ENTERPRISE_LABELS[page.enterprise] ?? page.enterprise) : null;
  const wordCount = page.body.split(/\s+/).filter(Boolean).length;
  const charCount = page.body.length;

  return (
    <div className="space-y-0">
      <PropertyRow icon={Calendar} label="date">
        <span className="font-mono text-[11px]">{formatDateFull(page.updated_at)}</span>
      </PropertyRow>

      {cat && (
        <PropertyRow icon={FolderOpen} label="category">
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: cat.color }}>
            {cat.label}
          </span>
        </PropertyRow>
      )}

      {entLabel && (
        <PropertyRow icon={Building2} label="enterprise">
          <span className="font-medium text-[11px]">{entLabel}</span>
        </PropertyRow>
      )}

      <PropertyRow icon={Tag} label="tags">
        <EditableTagList
          items={page.tags}
          onSave={(tags) => onUpdateTags?.(tags)}
        />
      </PropertyRow>

      <PropertyRow icon={Link2} label="aliases">
        <EditableTagList
          items={page.aliases ?? []}
          onSave={(aliases) => onUpdateAliases?.(aliases)}
          color="blue"
        />
      </PropertyRow>

      <PropertyRow icon={Users} label="stats">
        <span className="text-[10px] text-stone-500">
          {page.outgoing_links.length} links · {page.backlinks.length} backlinks · {wordCount} words · {charCount.toLocaleString()} chars
        </span>
      </PropertyRow>
    </div>
  );
}
