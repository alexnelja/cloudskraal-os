import { useEffect, useState } from 'react';
import FluidDialog from './FluidDialog';
import { updateField } from '../../api/farms';
import { ENTERPRISE_LABELS } from '../../types/farm';
import type { Farm, Field } from '../../types/farm';

interface EditFieldModalProps {
  open: boolean;
  field: Field | null;
  onClose: () => void;
  onUpdated: (field: Field) => void;
  farms: Farm[];
  enterprises: string[];
}

export default function EditFieldModal({
  open, field, onClose, onUpdated, farms, enterprises,
}: EditFieldModalProps) {
  const [name, setName] = useState('');
  const [enterprise, setEnterprise] = useState('');
  const [cropType, setCropType] = useState('');
  const [area, setArea] = useState('');
  const [plantedYear, setPlantedYear] = useState('');
  const [status, setStatus] = useState('active');
  const [soilType, setSoilType] = useState('');
  const [irrigationType, setIrrigationType] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !field) return;
    setName(field.name);
    setEnterprise(field.enterprise);
    setCropType(field.crop_type ?? '');
    setArea(String(field.area_ha));
    setPlantedYear(field.planted_year ?? '');
    setStatus(field.status);
    setSoilType(field.soil_type ?? '');
    setIrrigationType(field.irrigation_type ?? '');
    setNotes(field.notes ?? '');
    setError(null);
  }, [open, field]);

  if (!open || !field) return null;

  const farmName = farms.find(f => f.id === field.farm_id)?.name ?? 'Unknown';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !field) return;
    if (!name.trim()) { setError('Name is required'); return; }
    const normalised = area.replace(',', '.');
    const areaNum = Number(normalised);
    if (!Number.isFinite(areaNum) || areaNum <= 0) { setError('Area must be a positive number'); return; }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateField(field.id, {
        name: name.trim(),
        enterprise,
        crop_type: cropType || null,
        area_ha: areaNum,
        planted_year: plantedYear || null,
        status,
        soil_type: soilType || null,
        irrigation_type: irrigationType || null,
        notes: notes || null,
      });
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FluidDialog open={true} onDismiss={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-3">
        <h2 className="text-[15px] font-semibold text-stone-800">Edit field</h2>
        <p className="text-[11px] text-stone-500">Farm: {farmName}</p>
        <label className="block text-[11px] font-medium text-stone-600">
          Name
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]" autoFocus
          />
        </label>
        <div className="flex gap-2">
          <label className="flex-1 block text-[11px] font-medium text-stone-600">
            Enterprise
            <select
              value={enterprise} onChange={(e) => setEnterprise(e.target.value)}
              className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
            >
              {enterprises.map((ent) => <option key={ent} value={ent}>{ENTERPRISE_LABELS[ent] ?? ent}</option>)}
            </select>
          </label>
          <label className="flex-1 block text-[11px] font-medium text-stone-600">
            Status
            <select
              value={status} onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
            >
              <option value="active">Active</option>
              <option value="fallow">Fallow</option>
              <option value="replanting">Replanting</option>
              <option value="retired">Retired</option>
            </select>
          </label>
        </div>
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
              type="text" inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)}
              className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
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
        <div className="flex gap-2">
          <label className="flex-1 block text-[11px] font-medium text-stone-600">
            Soil type
            <input
              type="text" value={soilType} onChange={(e) => setSoilType(e.target.value)}
              placeholder="e.g. sandy loam"
              className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
            />
          </label>
          <label className="flex-1 block text-[11px] font-medium text-stone-600">
            Irrigation
            <input
              type="text" value={irrigationType} onChange={(e) => setIrrigationType(e.target.value)}
              placeholder="e.g. drip"
              className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
            />
          </label>
        </div>
        <label className="block text-[11px] font-medium text-stone-600">
          Notes
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
          />
        </label>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass-button rounded-lg px-3 py-1.5 text-[12px]">Cancel</button>
          <button type="submit" disabled={saving} className="bg-emerald-700 text-white rounded-lg px-3 py-1.5 text-[12px] font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </FluidDialog>
  );
}
