import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getField } from '../../api/farms';
import type { Field, FieldProduction } from '../../types/farm';
import { ENTERPRISE_COLORS, ENTERPRISE_LABELS } from '../../types/farm';

interface FieldPanelProps {
  fieldId: string | null;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  fallow: 'bg-stone-100 text-stone-700',
  planned: 'bg-blue-100 text-blue-800',
  retired: 'bg-red-100 text-red-700',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function hasProductionData(production: FieldProduction[]): boolean {
  return production.some(
    (p) => p.estimated_yield_kg !== null || p.actual_yield_kg !== null
  );
}

export default function FieldPanel({ fieldId, onClose }: FieldPanelProps) {
  const [field, setField] = useState<Field | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fieldId) {
      setField(null);
      return;
    }
    setLoading(true);
    setError(null);
    getField(fieldId)
      .then((data) => {
        setField(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load field:', err);
        setError('Failed to load field details.');
        setLoading(false);
      });
  }, [fieldId]);

  const isOpen = fieldId !== null;

  // Production chart data
  const chartData =
    field?.production
      ?.filter(
        (p) => p.estimated_yield_kg !== null || p.actual_yield_kg !== null
      )
      .sort((a, b) => a.year - b.year)
      .map((p) => ({
        year: p.year,
        Estimated: p.estimated_yield_kg ?? 0,
        Actual: p.actual_yield_kg ?? 0,
      })) ?? [];

  const showChart =
    field?.production && hasProductionData(field.production) && chartData.length > 0;

  const enterpriseColor = field
    ? ENTERPRISE_COLORS[field.enterprise] ?? ENTERPRISE_COLORS.unclassified
    : '#d1d5db';
  const enterpriseLabel = field
    ? ENTERPRISE_LABELS[field.enterprise] ?? field.enterprise
    : '';

  const statusClass =
    STATUS_COLORS[field?.status ?? ''] ?? 'bg-stone-100 text-stone-700';

  return (
    <>
      {/* Desktop panel — fixed right, slides in from right */}
      <div
        className={`
          hidden md:flex flex-col
          fixed top-0 right-0 h-full w-[400px]
          bg-white border-l border-stone-200 shadow-xl
          overflow-y-auto z-40
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <PanelContent
          field={field}
          loading={loading}
          error={error}
          chartData={chartData}
          showChart={showChart ?? false}
          enterpriseColor={enterpriseColor}
          enterpriseLabel={enterpriseLabel}
          statusClass={statusClass}
          onClose={onClose}
          showDragHandle={false}
        />
      </div>

      {/* Mobile panel — fixed bottom sheet, slides up from bottom */}
      <div
        className={`
          flex md:hidden flex-col
          fixed bottom-0 left-0 w-full max-h-[70vh]
          bg-white rounded-t-2xl shadow-xl
          overflow-y-auto z-40
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        <PanelContent
          field={field}
          loading={loading}
          error={error}
          chartData={chartData}
          showChart={showChart ?? false}
          enterpriseColor={enterpriseColor}
          enterpriseLabel={enterpriseLabel}
          statusClass={statusClass}
          onClose={onClose}
          showDragHandle
        />
      </div>
    </>
  );
}

interface ChartRow {
  year: number;
  Estimated: number;
  Actual: number;
}

interface PanelContentProps {
  field: Field | null;
  loading: boolean;
  error: string | null;
  chartData: ChartRow[];
  showChart: boolean;
  enterpriseColor: string;
  enterpriseLabel: string;
  statusClass: string;
  onClose: () => void;
  showDragHandle: boolean;
}

function PanelContent({
  field,
  loading,
  error,
  chartData,
  showChart,
  enterpriseColor,
  enterpriseLabel,
  statusClass,
  onClose,
  showDragHandle,
}: PanelContentProps) {
  return (
    <div className="flex flex-col min-h-0">
      {/* Drag handle (mobile only) */}
      {showDragHandle && (
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-stone-200 px-4 py-3 flex items-start justify-between gap-3 flex-shrink-0 z-10">
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="h-5 w-40 bg-stone-200 rounded animate-pulse" />
          ) : field ? (
            <>
              <h2 className="text-lg font-bold text-stone-900 truncate">{field.name}</h2>
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: enterpriseColor }}
              >
                {enterpriseLabel}
              </span>
            </>
          ) : (
            <h2 className="text-lg font-bold text-stone-900">Field Details</h2>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors mt-0.5"
          aria-label="Close panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 bg-stone-100 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
            ))}
          </div>
        )}

        {error && (
          <div className="p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && field && (
          <>
            {/* Info Grid */}
            <div className="p-4 grid grid-cols-2 gap-3">
              <InfoCell label="Farm" value={field.farm_name ?? '—'} />
              <InfoCell label="Code" value={field.code ?? '—'} />
              <InfoCell label="Area" value={`${field.area_ha.toFixed(1)} ha`} />
              <InfoCell label="Planted" value={field.planted_year ?? '—'} />
              <div>
                <p className="text-xs text-stone-500 mb-1">Status</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusClass}`}>
                  {field.status}
                </span>
              </div>
              <InfoCell label="Irrigation" value={field.irrigation_type ?? 'Dryland'} />
            </div>

            {/* Production Chart */}
            {showChart && (
              <div className="px-4 pb-4">
                <h3 className="text-sm font-semibold text-stone-700 mb-3">
                  Production History (kg)
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 10, fill: '#78716c' }}
                      tickFormatter={(val: number) => (val % 5 === 0 ? String(val) : '')}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#78716c' }}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e5e4' }}
                      formatter={(value: number, name: string) => [
                        `${value.toLocaleString()} kg`,
                        name,
                      ]}
                      labelFormatter={(label: number) => `Year: ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Estimated" fill="#d6d3d1" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Actual" fill="#059669" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Notes */}
            <div className="px-4 pb-4">
              <h3 className="text-sm font-semibold text-stone-700 mb-3">
                Notes{field.field_notes && field.field_notes.length > 0 ? ` (${field.field_notes.length})` : ''}
              </h3>
              {field.field_notes && field.field_notes.length > 0 ? (
                <ul className="space-y-2">
                  {field.field_notes.map((note) => (
                    <li
                      key={note.id}
                      className="border border-stone-200 rounded-lg p-3 bg-stone-50"
                    >
                      {note.title && (
                        <p className="text-sm font-medium text-stone-800 mb-0.5">{note.title}</p>
                      )}
                      {note.body && (
                        <p className="text-xs text-stone-600 line-clamp-2">{note.body}</p>
                      )}
                      <p className="text-xs text-stone-400 mt-1">{formatDate(note.created_at)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone-400">No notes yet.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Quick Actions */}
      {field && !loading && (
        <div className="flex-shrink-0 border-t border-stone-200 p-4">
          <button
            onClick={() => console.log('Add note for field:', field.id)}
            className="w-full border border-emerald-700 text-emerald-700 rounded-lg py-2 px-4 text-sm font-medium hover:bg-emerald-50 transition-colors"
          >
            + Add Note
          </button>
        </div>
      )}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-stone-500 mb-0.5">{label}</p>
      <p className="text-sm text-stone-800 font-medium">{value}</p>
    </div>
  );
}
