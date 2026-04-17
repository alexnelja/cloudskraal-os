import { ENTERPRISE_LABELS, ENTERPRISE_COLORS } from '../../types/farm';

interface EnterpriseFilterBarProps {
  enterprises: string[];
  visibleEnterprises: string[];
  onToggle: (enterprise: string) => void;
  onShowAll: () => void;
}

export default function EnterpriseFilterBar({
  enterprises,
  visibleEnterprises,
  onToggle,
  onShowAll,
}: EnterpriseFilterBarProps) {
  const filtered = enterprises.filter(e => e !== 'farm_boundary' && e !== 'unclassified');
  if (filtered.length === 0) return null;

  const allVisible = visibleEnterprises.length >= filtered.length;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filtered.map((ent) => {
        const active = visibleEnterprises.includes(ent);
        const color = ENTERPRISE_COLORS[ent] ?? '#6b7280';
        const label = ENTERPRISE_LABELS[ent] ?? ent.charAt(0).toUpperCase() + ent.slice(1);
        return (
          <button
            key={ent}
            type="button"
            onClick={() => onToggle(ent)}
            aria-pressed={active}
            className={`
              px-2.5 py-1 rounded-full text-[11px] font-medium transition-all
              ${active
                ? 'text-white shadow-sm'
                : 'bg-white/60 text-stone-500 hover:bg-white/80 line-through decoration-stone-300'}
            `}
            style={active ? { backgroundColor: color } : undefined}
          >
            {label}
          </button>
        );
      })}
      {!allVisible && (
        <button
          type="button"
          onClick={onShowAll}
          className="text-[11px] text-stone-400 hover:text-stone-600 ml-0.5 transition-colors"
        >
          Show all
        </button>
      )}
    </div>
  );
}
