import { useState } from 'react';
import type { CreateProjectPayload, ProjectType } from '../types';
import ZARInput from './ZARInput';
import Sheet from './ui/Sheet';

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

const labelCls = 'md-label-large block mb-1';
const labelStyle = { color: 'var(--md-sys-color-on-surface-variant)' } as const;
const inputCls =
  'md-body-medium w-full md-shape-medium px-3 py-2 focus:outline-none focus:ring-2';
const inputStyle = {
  backgroundColor: 'var(--md-sys-color-surface-container-low)',
  border: '1px solid var(--md-sys-color-outline-variant)',
  color: 'var(--md-sys-color-on-surface)',
} as const;

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Sheet open={open} onClose={onClose} title={title} id="project-modal">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label htmlFor="project-name" className={labelCls} style={labelStyle}>
            Project Name <span aria-hidden="true">*</span>
            <span className="sr-only"> (required)</span>
          </label>
          <input
            id="project-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoComplete="off"
            className={inputCls}
            style={inputStyle}
            placeholder="e.g. New Tractor Purchase"
          />
        </div>

        <div>
          <label htmlFor="project-type" className={labelCls} style={labelStyle}>
            Type
          </label>
          <select
            id="project-type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as ProjectType })}
            className={inputCls}
            style={inputStyle}
          >
            {PROJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="project-desc" className={labelCls} style={labelStyle}>
            Description
          </label>
          <textarea
            id="project-desc"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className={`${inputCls} resize-none`}
            style={inputStyle}
            placeholder="Brief description of the capital expenditure…"
          />
        </div>

        <div>
          <label htmlFor="project-outlay" className={labelCls} style={labelStyle}>
            Initial Outlay (ZAR)
          </label>
          <ZARInput
            id="project-outlay"
            value={form.initialOutlay}
            onChange={(v) => setForm({ ...form, initialOutlay: v })}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="project-life" className={labelCls} style={labelStyle}>
              Useful Life (Years)
            </label>
            <input
              id="project-life"
              type="number"
              min={1}
              max={50}
              value={form.usefulLifeYears}
              onChange={(e) =>
                setForm({ ...form, usefulLifeYears: parseInt(e.target.value) || 1 })
              }
              className={inputCls}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="project-salvage" className={labelCls} style={labelStyle}>
              Salvage Value (ZAR)
            </label>
            <ZARInput
              id="project-salvage"
              value={form.salvageValue}
              onChange={(v) => setForm({ ...form, salvageValue: v })}
              className="w-full"
            />
          </div>
        </div>

        <div
          className="flex justify-end gap-2 pt-4"
          style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="md-label-large md-shape-full px-5 py-2.5 md-duration-short3 md-ease-standard transition-colors"
            style={{ color: 'var(--md-sys-color-primary)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="md-label-large md-shape-full px-5 py-2.5 md-duration-short3 md-ease-standard transition-colors"
            style={{
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
            }}
          >
            Create Project
          </button>
        </div>
      </form>
    </Sheet>
  );
}
