import { useState } from 'react';
import { X } from 'lucide-react';
import type { CreateProjectPayload, ProjectType } from '../types';
import ZARInput from './ZARInput';

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'equipment', label: 'Equipment' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'land', label: 'Land' },
  { value: 'livestock', label: 'Livestock' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'solar', label: 'Solar' },
  { value: 'storage', label: 'Storage' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'other', label: 'Other' },
];

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectPayload) => void;
  initialData?: Partial<CreateProjectPayload>;
  title?: string;
}

export default function ProjectModal({
  open,
  onClose,
  onSubmit,
  initialData,
  title = 'New Project',
}: ProjectModalProps) {
  const [form, setForm] = useState<CreateProjectPayload>({
    name: initialData?.name || '',
    type: initialData?.type || 'equipment',
    description: initialData?.description || '',
    initialOutlay: initialData?.initialOutlay || 0,
    usefulLifeYears: initialData?.usefulLifeYears || 10,
    salvageValue: initialData?.salvageValue || 0,
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Project Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="e.g. New Tractor Purchase"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ProjectType })}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {PROJECT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              placeholder="Brief description of the capital expenditure..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Initial Outlay (ZAR)
            </label>
            <ZARInput
              value={form.initialOutlay}
              onChange={(v) => setForm({ ...form, initialOutlay: v })}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Useful Life (Years)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={form.usefulLifeYears}
                onChange={(e) => setForm({ ...form, usefulLifeYears: parseInt(e.target.value) || 1 })}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Salvage Value (ZAR)
              </label>
              <ZARInput
                value={form.salvageValue}
                onChange={(v) => setForm({ ...form, salvageValue: v })}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 transition-colors"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
