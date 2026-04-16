import { useState } from 'react';
import FluidDialog from './FluidDialog';
import { createMeasurement } from '../../api/measurements';
import type { MeasurementKind, MeasurementUnit, Measurement } from '../../types/measurement';

interface SaveMeasurementModalProps {
  open: boolean;
  kind: MeasurementKind;
  value: number;
  unit: MeasurementUnit;
  formatted: string;
  geometry: GeoJSON.Geometry;
  onSaved: (m: Measurement) => void;
  onDiscard: () => void;
}

export default function SaveMeasurementModal({
  open,
  kind,
  value,
  unit,
  formatted,
  geometry,
  onSaved,
  onDiscard,
}: SaveMeasurementModalProps) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const m = await createMeasurement({
        name: name.trim(),
        kind,
        value,
        unit,
        formatted,
        geometry: typeof geometry === 'string' ? geometry : JSON.stringify(geometry),
        field_id: null,
        notes: notes.trim() || null,
      });
      onSaved(m);
      setName('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FluidDialog open={true} onDismiss={onDiscard} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-3">
        <h2 className="text-[15px] font-semibold text-stone-800">Save measurement</h2>

        <div className="px-3 py-2 bg-amber-50/60 rounded-lg">
          <span className="text-[13px] font-mono text-amber-800 font-semibold">{formatted}</span>
        </div>

        <label className="block text-[11px] font-medium text-stone-600">
          Name
          <input
            aria-label="Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
            autoFocus
          />
        </label>

        <label className="block text-[11px] font-medium text-stone-600">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
          />
        </label>

        {error && <p className="text-[11px] text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onDiscard}
            className="glass-button rounded-lg px-3 py-1.5 text-[12px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-700 text-white rounded-lg px-3 py-1.5 text-[12px] font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </FluidDialog>
  );
}
