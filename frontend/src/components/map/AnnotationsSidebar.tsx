import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X } from '@phosphor-icons/react';
import type { Annotation, AnnotationType } from '../../types/annotation';
import type { Measurement } from '../../types/measurement';
import { listMeasurements, deleteMeasurement } from '../../api/measurements';
import { formatDistance, formatArea } from './tools/metricFormat';
import { getCategoryDef, CATEGORIES } from './annotationCategories';
import FluidSheet from './FluidSheet';

interface AnnotationsSidebarProps {
  open: boolean;
  annotations: Annotation[];
  selectedId: string | null;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  taskCountById?: Record<string, number>;
}

type FilterValue = 'all' | AnnotationType;
type SidebarTab = 'annotations' | 'measurements';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'line', label: 'Lines' },
  { value: 'polygon', label: 'Polygons' },
  { value: 'pin', label: 'Pins' },
];

function metricFor(a: Annotation): string {
  if (a.type === 'line') return formatDistance(a.length_m);
  if (a.type === 'polygon') return formatArea(a.area_m2);
  return '';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export default function AnnotationsSidebar({
  open,
  annotations,
  selectedId,
  onToggle,
  onSelect,
  onDelete,
  taskCountById = {},
}: AnnotationsSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('annotations');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  useEffect(() => {
    if (!open) return;
    listMeasurements()
      .then(setMeasurements)
      .catch((err) => console.warn('Failed to load measurements:', err));
  }, [open]);

  // Available categories given the type filter
  const categoryOptions = useMemo(() => {
    if (filter === 'all') {
      const union = new Set<string>();
      Object.values(CATEGORIES).forEach((list) => list.forEach((c) => union.add(c.id)));
      return ['all', ...Array.from(union).sort()];
    }
    return ['all', ...CATEGORIES[filter].map((c) => c.id)];
  }, [filter]);

  const filtered = annotations
    .filter((a) => filter === 'all' || a.type === filter)
    .filter((a) => categoryFilter === 'all' || (a.category ?? 'generic') === categoryFilter);

  return (
    <FluidSheet open={open} onDismiss={onToggle}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200/60">
        <div className="flex items-center gap-2">
          <span className="font-serif text-base text-stone-900 tracking-tight">
            {activeTab === 'measurements' ? 'Measurements' : 'Annotations'}
          </span>
          <span
            data-testid="annotation-count"
            className="text-[11px] bg-amber-100/70 text-amber-800 rounded-full px-2 py-0.5 font-mono"
          >
            {activeTab === 'measurements' ? measurements.length : annotations.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-stone-500 hover:text-stone-900 hover:bg-stone-100/60 rounded-md p-1 transition"
          aria-label="Close sidebar"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 px-4 py-2 border-b border-stone-200/60">
        <motion.button
          type="button"
          onClick={() => setActiveTab('annotations')}
          whileTap={{ scale: 0.94 }}
          className={`px-3 py-1 text-[11px] uppercase tracking-wide rounded-full whitespace-nowrap transition-colors ${
            activeTab === 'annotations' ? 'text-white' : 'text-stone-700 hover:text-stone-900'
          }`}
          style={{
            background: activeTab === 'annotations'
              ? 'linear-gradient(135deg, #d97706, #b45309)'
              : 'rgba(245, 240, 233, 0.6)',
          }}
        >
          Annotations
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setActiveTab('measurements')}
          whileTap={{ scale: 0.94 }}
          className={`px-3 py-1 text-[11px] uppercase tracking-wide rounded-full whitespace-nowrap transition-colors ${
            activeTab === 'measurements' ? 'text-white' : 'text-stone-700 hover:text-stone-900'
          }`}
          style={{
            background: activeTab === 'measurements'
              ? 'linear-gradient(135deg, #d97706, #b45309)'
              : 'rgba(245, 240, 233, 0.6)',
          }}
        >
          Measurements
        </motion.button>
      </div>

      {activeTab === 'annotations' && (
        <>
          <div className="flex gap-1 px-4 py-2 border-b border-stone-200/60 overflow-x-auto">
            {FILTERS.map((f) => {
              const isActive = filter === f.value;
              return (
                <motion.button
                  key={f.value}
                  type="button"
                  onClick={() => {
                    setFilter(f.value);
                    setCategoryFilter('all');
                  }}
                  whileTap={{ scale: 0.94 }}
                  className={`px-3 py-1 text-[11px] uppercase tracking-wide rounded-full whitespace-nowrap transition-colors ${
                    isActive ? 'text-white' : 'text-stone-700 hover:text-stone-900'
                  }`}
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, #d97706, #b45309)'
                      : 'rgba(245, 240, 233, 0.6)',
                    boxShadow: isActive
                      ? 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px -2px rgba(180, 83, 9, 0.4)'
                      : 'none',
                  }}
                >
                  {f.label}
                </motion.button>
              );
            })}
          </div>

          <div className="px-4 py-2 border-b border-stone-200/60">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full border border-stone-300/60 rounded-md px-2 py-1 text-xs bg-white/60 backdrop-blur-sm focus:outline-none focus:border-amber-500"
              aria-label="Category filter"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All categories' : c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-stone-500">
                No annotations yet — draw on the map and save.
              </div>
            ) : (
              <ul>
                {filtered.map((a, idx) => {
                  const isSelected = a.id === selectedId;
                  const def = getCategoryDef(a.type, a.category);
                  const Icon = def.Icon;
                  return (
                    <motion.li
                      key={a.id}
                      data-annotation-row
                      data-selected={isSelected}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02, duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                      whileHover={{ x: 2 }}
                      className={`border-b border-stone-200/50 px-4 py-3 cursor-pointer transition-colors`}
                      style={{
                        background: isSelected
                          ? 'linear-gradient(90deg, rgba(254, 243, 199, 0.7), rgba(254, 243, 199, 0))'
                          : undefined,
                        borderLeft: isSelected
                          ? '2px solid #d97706'
                          : '2px solid transparent',
                      }}
                      onClick={() => onSelect(a.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              data-testid="category-icon"
                              className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-amber-700"
                              style={{
                                background:
                                  'linear-gradient(135deg, rgba(254, 243, 199, 0.9), rgba(253, 224, 155, 0.4))',
                                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.7)',
                              }}
                            >
                              <Icon size={14} weight={isSelected ? 'duotone' : 'regular'} />
                            </span>
                            <span className="font-medium text-stone-900 truncate">{a.title}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {metricFor(a) && (
                              <span className="text-[11px] text-stone-600 font-mono">
                                {metricFor(a)}
                              </span>
                            )}
                            <span className="text-[10px] uppercase tracking-wide text-stone-400">
                              {def.label}
                            </span>
                            {taskCountById[a.id] > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono">
                                {taskCountById[a.id]} task
                                {taskCountById[a.id] === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-stone-400 mt-0.5 font-mono">
                            {formatDate(a.created_at)}
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label="Delete annotation"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete "${a.title}"?`)) onDelete(a.id);
                          }}
                          className="text-stone-400 hover:text-red-600 text-[11px] transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {activeTab === 'measurements' && (
        <div className="flex-1 overflow-y-auto">
          {measurements.length === 0 ? (
            <div className="p-6 text-center text-sm text-stone-500">
              No measurements saved yet — use the measure tools and save as Measurement.
            </div>
          ) : (
            <ul>
              {measurements.map((m, idx) => (
                <motion.li
                  key={m.id}
                  data-measurement-row
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                  className="border-b border-stone-200/50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-stone-900 truncate block">{m.name}</span>
                      <span className="text-[11px] text-stone-600 font-mono">{m.formatted}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label="Copy measurement"
                        onClick={() => navigator.clipboard.writeText(m.formatted).catch(() => {})}
                        className="text-stone-400 hover:text-stone-700 text-[11px] transition-colors px-1"
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        aria-label="Delete measurement"
                        onClick={() => {
                          if (window.confirm(`Delete "${m.name}"?`)) {
                            deleteMeasurement(m.id)
                              .then(() => setMeasurements((prev) => prev.filter((x) => x.id !== m.id)))
                              .catch((err) => console.error('Delete measurement failed:', err));
                          }
                        }}
                        className="text-stone-400 hover:text-red-600 text-[11px] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5 font-mono">
                    {formatDate(m.created_at)}
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      )}
    </FluidSheet>
  );
}
