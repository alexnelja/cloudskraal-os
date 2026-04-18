import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import length from '@turf/length';
import area from '@turf/area';
import { lineString, polygon } from '@turf/helpers';
import type { AnnotationType, CreateAnnotationInput } from '../../types/annotation';
import { formatDistance, formatArea } from './tools/metricFormat';
import { CATEGORIES, getCategoryDef } from './annotationCategories';
import FluidDialog from './FluidDialog';

interface SaveAnnotationModalProps {
  open: boolean;
  type: AnnotationType;
  geometry: GeoJSON.Geometry;
  onSave: (input: CreateAnnotationInput) => void;
  onDiscard: () => void;
}

function computeMetricLabel(type: AnnotationType, geometry: GeoJSON.Geometry): string | null {
  try {
    if (type === 'line' && geometry.type === 'LineString') {
      const meters = length(lineString(geometry.coordinates), { units: 'meters' });
      return formatDistance(meters);
    }
    if (type === 'polygon' && geometry.type === 'Polygon') {
      const m2 = area(polygon(geometry.coordinates));
      return formatArea(m2);
    }
  } catch {
    return null;
  }
  return null;
}

export default function SaveAnnotationModal({
  open,
  type,
  geometry,
  onSave,
  onDiscard,
}: SaveAnnotationModalProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<string>('generic');
  // Tracks whether the user has hand-edited the title; when false, title
  // auto-follows the selected category so Save is immediately usable.
  const [titleDirty, setTitleDirty] = useState(false);

  // Reset when type changes so the picker shows valid options
  useEffect(() => {
    setCategory('generic');
  }, [type]);

  // Reset form when reopened
  useEffect(() => {
    if (!open) {
      setTitle('');
      setNotes('');
      setCategory('generic');
      setTitleDirty(false);
      setCategorySearch('');
    }
  }, [open]);

  // Auto-seed title from category label while user hasn't edited.
  useEffect(() => {
    if (titleDirty) return;
    const def = getCategoryDef(type, category);
    setTitle(def.label);
  }, [type, category, titleDirty]);

  const metric = useMemo(() => computeMetricLabel(type, geometry), [type, geometry]);
  const allCategories = CATEGORIES[type] ?? [];
  const [categorySearch, setCategorySearch] = useState('');
  const showCategorySearch = allCategories.length > 10;
  const categories = showCategorySearch && categorySearch.trim()
    ? allCategories.filter(c => c.label.toLowerCase().includes(categorySearch.trim().toLowerCase()))
    : allCategories;
  const selectedDef = getCategoryDef(type, category);
  const SelectedIcon = selectedDef.Icon;

  const canSave = title.trim().length > 0;
  const handleSave = () => {
    if (!canSave) return;
    onSave({
      type,
      title: title.trim(),
      notes: notes.trim() || null,
      geometry,
      category,
    });
  };

  const typeLabel = type === 'line' ? 'Line' : type === 'polygon' ? 'Area' : 'Pin';

  return (
    <FluidDialog open={open} onDismiss={onDiscard}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <motion.div
            key={selectedDef.id}
            initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="p-2.5 rounded-xl text-amber-700"
            style={{
              background:
                'linear-gradient(135deg, rgba(254, 243, 199, 0.9), rgba(253, 224, 155, 0.6))',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 4px 12px -4px rgba(146, 64, 14, 0.25)',
            }}
          >
            <SelectedIcon size={22} weight="duotone" />
          </motion.div>
          <h2 className="text-xl font-serif font-medium text-stone-900 tracking-tight">
            Save {typeLabel}
            <span className="text-sm font-sans font-normal text-stone-500 ml-2">
              {selectedDef.label}
            </span>
          </h2>
        </div>
        {metric && (
          <p
            className="text-sm text-stone-600 mb-4 font-mono tracking-tight"
            data-testid="annotation-metric"
          >
            {metric}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="ann-title"
              className="block text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-600 mb-1.5"
            >
              Title
            </label>
            <input
              id="ann-title"
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleDirty(true); }}
              autoFocus
              className="w-full bg-white/60 border border-stone-300/80 rounded-lg px-3 py-2 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-400/30 transition"
              placeholder="e.g. Broken fence"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-600 mb-2">
              Category
            </label>
            {showCategorySearch && (
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search categories…"
                className="w-full bg-white/60 border border-stone-300/80 rounded-lg px-3 py-1.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/30 transition mb-2"
              />
            )}
            <div
              className="grid grid-cols-3 sm:grid-cols-4 gap-1.5"
              role="radiogroup"
              aria-label="Category"
            >
              {categories.map((c) => {
                const Icon = c.Icon;
                const isSelected = c.id === category;
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={c.label}
                    data-category={c.id}
                    onClick={() => setCategory(c.id)}
                    whileTap={{ scale: 0.94 }}
                    whileHover={{ y: -1 }}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-xs transition-colors ${
                      isSelected
                        ? 'text-amber-900'
                        : 'text-stone-700 hover:text-stone-900'
                    }`}
                    style={{
                      border: isSelected
                        ? '1px solid rgba(217, 119, 6, 0.5)'
                        : '1px solid rgba(168, 162, 158, 0.3)',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(254, 243, 199, 0.9), rgba(253, 224, 155, 0.5))'
                        : 'rgba(255, 255, 255, 0.5)',
                      boxShadow: isSelected
                        ? 'inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 2px 8px -2px rgba(146, 64, 14, 0.15)'
                        : undefined,
                    }}
                  >
                    <Icon size={20} weight={isSelected ? 'duotone' : 'regular'} />
                    <span className="text-[10px] leading-tight text-center">{c.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="ann-notes"
              className="block text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-600 mb-1.5"
            >
              Notes
            </label>
            <textarea
              id="ann-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-white/60 border border-stone-300/80 rounded-lg px-3 py-2 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-400/30 transition resize-none"
              placeholder="Optional context"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg transition"
          >
            Discard
          </button>
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            whileTap={{ scale: canSave ? 0.96 : 1 }}
            whileHover={{ scale: canSave ? 1.02 : 1 }}
            className="px-4 py-2 rounded-lg text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
            style={{
              background: canSave
                ? 'linear-gradient(135deg, #d97706, #b45309)'
                : '#9ca3af',
              boxShadow: canSave
                ? 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 4px 12px -2px rgba(180, 83, 9, 0.45)'
                : 'none',
            }}
          >
            Save
          </motion.button>
        </div>
      </div>
    </FluidDialog>
  );
}
