import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createCalendarEvent, updateCalendarEvent } from '../../api/calendar';
import type { CalendarEvent } from '../../types/calendar';

interface EventEditorProps {
  event?: CalendarEvent;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

const ENTERPRISES = [
  { value: '', label: 'None' },
  { value: 'rooibos', label: 'Rooibos' },
  { value: 'wine', label: 'Wine / Grapes' },
  { value: 'sheep', label: 'Sheep / Grazing' },
  { value: 'buchu', label: 'Buchu' },
  { value: 'general', label: 'General' },
];

const RECURRENCE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'FREQ=YEARLY', label: 'Yearly' },
  { value: 'FREQ=MONTHLY', label: 'Monthly' },
];

const COLOR_OPTIONS = [
  { value: '', label: 'Default (enterprise)' },
  { value: '#047857', label: 'Green' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#d97706', label: 'Amber' },
  { value: '#dc2626', label: 'Red' },
  { value: '#6b7280', label: 'Grey' },
];

interface FormState {
  title: string;
  enterprise: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  recurrence_rule: string;
  color: string;
  notes: string;
}

export default function EventEditor({ event, open, onClose, onSave, defaultStartDate, defaultEndDate }: EventEditorProps) {
  const isEdit = !!event;

  const [form, setForm] = useState<FormState>({
    title: '',
    enterprise: '',
    start_date: '',
    end_date: '',
    all_day: true,
    recurrence_rule: '',
    color: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (event) {
        setForm({
          title: event.title,
          enterprise: event.enterprise ?? '',
          start_date: event.start_date.slice(0, 10),
          end_date: event.end_date?.slice(0, 10) ?? '',
          all_day: event.all_day,
          recurrence_rule: event.recurrence_rule ?? '',
          color: event.color ?? '',
          notes: event.notes ?? '',
        });
      } else {
        setForm({
          title: '',
          enterprise: '',
          start_date: defaultStartDate ?? '',
          end_date: defaultEndDate ?? '',
          all_day: true,
          recurrence_rule: '',
          color: '',
          notes: '',
        });
      }
    }
  }, [open, event, defaultStartDate, defaultEndDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      title: form.title,
      enterprise: form.enterprise || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      all_day: form.all_day,
      recurrence_rule: form.recurrence_rule || null,
      color: form.color || null,
      notes: form.notes || null,
    };

    try {
      if (isEdit) {
        await updateCalendarEvent(event.id, payload);
      } else {
        await createCalendarEvent(payload);
      }
      onSave();
    } catch (err) {
      console.error('Failed to save event:', err);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-800">
            {isEdit ? 'Edit Event' : 'New Event'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="e.g. Rooibos harvest window"
            />
          </div>

          {/* Enterprise */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Enterprise</label>
            <select
              value={form.enterprise}
              onChange={(e) => setForm({ ...form, enterprise: e.target.value })}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {ENTERPRISES.map((ent) => (
                <option key={ent.value} value={ent.value}>{ent.label}</option>
              ))}
            </select>
          </div>

          {/* Dates + All day */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="all-day"
              checked={form.all_day}
              onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
              className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="all-day" className="text-sm text-stone-700">All day event</label>
          </div>

          {/* Recurrence + Color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Recurrence</label>
              <select
                value={form.recurrence_rule}
                onChange={(e) => setForm({ ...form, recurrence_rule: e.target.value })}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Color</label>
              <select
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {COLOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              placeholder="Additional notes..."
            />
          </div>

          {/* Actions */}
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
              disabled={saving}
              className="px-5 py-2 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
