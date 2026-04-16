import { useEffect, useState } from 'react';
import FluidDialog from './FluidDialog';
import { createField } from '../../api/farms';
import { ENTERPRISE_LABELS } from '../../types/farm';
import type { Farm, Field } from '../../types/farm';

interface NewFieldModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (field: Field) => void;
  farms: Farm[];
  enterprises: string[];
  /** Optional — pre-filled from the measure save-as FIELD branch (5m). */
  geometry?: GeoJSON.Geometry;
  /** Optional — computed area_ha from the drawn polygon. */
  areaHa?: number;
}

export default function NewFieldModal({
  open, onClose, onCreated, farms, enterprises, geometry, areaHa,
}: NewFieldModalProps) {
  const [farmId, setFarmId] = useState('');
  const [name, setName] = useState('');
  const [enterprise, setEnterprise] = useState('');
  const [cropType, setCropType] = useState('');
  const [area, setArea] = useState('');
  const [plantedYear, setPlantedYear] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFarmId(farms[0]?.id ?? '');
    setName('');
    setEnterprise(enterprises[0] ?? '');
    setCropType('');
    setArea(areaHa != null ? String(areaHa) : '');
    setPlantedYear('');
    setNotes('');
    setError(null);
  }, [open, farms, enterprises, areaHa]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;  // prevent double-submit
    if (!name.trim()) { setError('Name is required'); return; }
    if (!farmId) { setError('Select a farm'); return; }
    if (!enterprise) { setError('Select an enterprise'); return; }
    const normalised = area.replace(',', '.');
    const areaNum = Number(normalised);
    if (!Number.isFinite(areaNum) || areaNum <= 0) { setError('Area must be a positive number'); return; }
    setSaving(true);
    setError(null);
    try {
      const field = await createField({
        farm_id: farmId,
        name: name.trim(),
        enterprise,
        area_ha: areaNum,
        crop_type: cropType || null,
        planted_year: plantedYear || null,
        geometry: geometry ? JSON.stringify(geometry) : null,
        notes: notes || null,
      });
      onCreated(field);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FluidDialog open={true} onDismiss={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-3">
        <h2 id="new-field-title" className="text-[15px] font-semibold text-stone-800">New field</h2>
        {geometry && (
          <p className="text-[11px] text-stone-500">
            Drawn polygon pre-filled — area locked to {areaHa?.toFixed(2)} ha.
          </p>
        )}
        <label className="block text-[11px] font-medium text-stone-600">
          Farm
          <select
            value={farmId} onChange={(e) => setFarmId(e.target.value)}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
          >
            {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="block text-[11px] font-medium text-stone-600">
          Name
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]" autoFocus
          />
        </label>
        <label className="block text-[11px] font-medium text-stone-600">
          Enterprise
          <select
            value={enterprise} onChange={(e) => setEnterprise(e.target.value)}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
          >
            <option value="">—</option>
            {enterprises.map((e) => <option key={e} value={e}>{ENTERPRISE_LABELS[e] ?? e}</option>)}
          </select>
        </label>
        <label className="block text-[11px] font-medium text-stone-600">
          Crop type (optional)
          <input
            type="text" value={cropType} onChange={(e) => setCropType(e.target.value)}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
          />
        </label>
        <div className="flex gap-2">
          <label className="flex-1 block text-[11px] font-medium text-stone-600">
            Area (ha)
            <input
              aria-label="Area (ha)"
              type="text" inputMode="decimal" placeholder="e.g. 1.5 or 1,5" value={area} onChange={(e) => setArea(e.target.value)}
              readOnly={areaHa != null}
              className={`mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px] ${areaHa != null ? 'bg-stone-100' : ''}`}
            />
          </label>
          <label className="flex-1 block text-[11px] font-medium text-stone-600">
            Planted year
            <input
              type="text" value={plantedYear} onChange={(e) => setPlantedYear(e.target.value)}
              placeholder="2024"
              className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
            />
          </label>
        </div>
        <label className="block text-[11px] font-medium text-stone-600">
          Notes (optional)
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
          />
        </label>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass-button rounded-lg px-3 py-1.5 text-[12px]">Cancel</button>
          <button type="submit" disabled={saving} className="bg-emerald-700 text-white rounded-lg px-3 py-1.5 text-[12px] font-medium disabled:opacity-50">
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </FluidDialog>
  );
}
