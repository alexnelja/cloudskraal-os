import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ClipboardList, BookOpen, BarChart3, Droplets, Clock, DollarSign, Layers,
  AlertTriangle, CheckCircle, Sprout,
} from 'lucide-react';
import {
  BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getField, getFieldCostOfProduction } from '../../api/farms';
import type {
  Field, FieldProduction, FieldCostOfProduction as FieldCostOfProductionType,
  FieldInputTransaction, FieldTaskInput, FieldLabourEntry,
  FieldRotation, CopLine,
} from '../../types/farm';
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

const TABS = ['Overview', 'Inputs', 'Labour', 'Costs'] as const;
type Tab = typeof TABS[number];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatZAR(amount: number): string {
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function hasProductionData(production: FieldProduction[]): boolean {
  return production.some(p => p.estimated_yield_kg !== null || p.actual_yield_kg !== null);
}

const CATEGORY_COLORS: Record<string, string> = {
  fertilizer: 'bg-emerald-100 text-emerald-700',
  herbicide: 'bg-red-100 text-red-700',
  pesticide: 'bg-amber-100 text-amber-700',
  fuel: 'bg-stone-200 text-stone-700',
  seed: 'bg-teal-100 text-teal-700',
};

export default function FieldPanel({ fieldId, onClose }: FieldPanelProps) {
  const [field, setField] = useState<Field | null>(null);
  const [costData, setCostData] = useState<FieldCostOfProductionType | null>(null);
  const [loading, setLoading] = useState(false);
  const [costLoading, setCostLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  useEffect(() => {
    if (!fieldId) {
      setField(null);
      setCostData(null);
      setActiveTab('Overview');
      return;
    }
    setLoading(true);
    setError(null);
    getField(fieldId)
      .then(data => { setField(data); setLoading(false); })
      .catch(err => { console.error('Failed to load field:', err); setError('Failed to load field details.'); setLoading(false); });

    setCostLoading(true);
    getFieldCostOfProduction(fieldId)
      .then(data => { setCostData(data); setCostLoading(false); })
      .catch(() => setCostLoading(false));
  }, [fieldId]);

  const isOpen = fieldId !== null;

  const chartData = field?.production
    ?.filter(p => p.estimated_yield_kg !== null || p.actual_yield_kg !== null)
    .sort((a, b) => a.year - b.year)
    .map(p => ({ year: p.year, Estimated: p.estimated_yield_kg ?? 0, Actual: p.actual_yield_kg ?? 0 })) ?? [];

  const showChart = field?.production && hasProductionData(field.production) && chartData.length > 0;

  const enterpriseColor = field ? ENTERPRISE_COLORS[field.enterprise] ?? ENTERPRISE_COLORS.unclassified : '#d1d5db';
  const enterpriseLabel = field ? ENTERPRISE_LABELS[field.enterprise] ?? field.enterprise : '';
  const statusClass = STATUS_COLORS[field?.status ?? ''] ?? 'bg-stone-100 text-stone-700';

  // Flatten lines into arrays for Inputs and Labour tabs
  const allInputs: FieldInputTransaction[] = costData?.lines.flatMap(l => l.inputs) ?? [];
  const allTaskInputs: FieldTaskInput[] = costData?.lines.flatMap(l => l.task_inputs) ?? [];
  const allLabour: FieldLabourEntry[] = costData?.lines.flatMap(l => l.labour) ?? [];

  const panelProps = {
    field, loading, error, chartData, showChart: showChart ?? false,
    enterpriseColor, enterpriseLabel, statusClass, onClose, fieldId,
    costData, costLoading, activeTab, setActiveTab,
    allInputs, allTaskInputs, allLabour,
  };

  return (
    <>
      <div className={`hidden md:flex flex-col fixed top-0 right-0 h-full w-[440px] bg-white border-l border-[#f3f4f3] shadow-xl overflow-y-auto z-40 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <PanelContent {...panelProps} showDragHandle={false} />
      </div>
      <div className={`flex md:hidden flex-col fixed bottom-0 left-0 w-full max-h-[80vh] bg-white rounded-t-2xl shadow-xl overflow-y-auto z-40 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <PanelContent {...panelProps} showDragHandle />
      </div>
    </>
  );
}

interface ChartRow { year: number; Estimated: number; Actual: number; }

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
  fieldId: string | null;
  costData: FieldCostOfProductionType | null;
  costLoading: boolean;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  allInputs: FieldInputTransaction[];
  allTaskInputs: FieldTaskInput[];
  allLabour: FieldLabourEntry[];
}

function PanelContent({
  field, loading, error, chartData, showChart, enterpriseColor, enterpriseLabel,
  statusClass, onClose, showDragHandle, fieldId, costData, costLoading, activeTab, setActiveTab,
  allInputs, allTaskInputs, allLabour,
}: PanelContentProps) {
  const navigate = useNavigate();
  const chartRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col min-h-0">
      {showDragHandle && (
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-[#f3f4f3] px-4 py-3 flex items-start justify-between gap-3 flex-shrink-0 z-10">
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="h-5 w-40 bg-stone-200 rounded animate-pulse" />
          ) : field ? (
            <>
              <h2 className="text-lg font-bold text-stone-900 truncate">{field.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: enterpriseColor }}>
                  {enterpriseLabel}
                </span>
                <span className="text-xs text-stone-500">{field.farm_name}</span>
                {field.area_ha && <span className="text-xs text-stone-500">· {field.area_ha.toFixed(1)} ha</span>}
              </div>
            </>
          ) : (
            <h2 className="text-lg font-bold text-stone-900">Field Details</h2>
          )}
        </div>
        <button onClick={onClose} className="flex-shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors mt-0.5" aria-label="Close panel">
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      {field && !loading && (
        <div className="flex border-b border-[#f3f4f3] px-2 flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 bg-stone-100 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
            ))}
          </div>
        )}

        {error && <div className="p-4"><p className="text-sm text-red-600">{error}</p></div>}

        {!loading && !error && field && (
          <>
            {activeTab === 'Overview' && (
              <OverviewTab
                field={field} statusClass={statusClass} showChart={showChart}
                chartData={chartData} chartRef={chartRef}
                costData={costData} rotation={costData?.rotation ?? null}
              />
            )}
            {activeTab === 'Inputs' && (
              <InputsTab inputs={allInputs} taskInputs={allTaskInputs} loading={costLoading} />
            )}
            {activeTab === 'Labour' && (
              <LabourTab labour={allLabour} loading={costLoading} />
            )}
            {activeTab === 'Costs' && (
              <CostsTab
                costData={costData}
                field={field}
                loading={costLoading}
              />
            )}
          </>
        )}
      </div>

      {/* Quick Actions */}
      {field && !loading && (
        <div className="flex-shrink-0 border-t border-[#f3f4f3] p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigate(`/calendar?create=true&field_id=${fieldId}`)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors">
              <ClipboardList size={14} className="text-emerald-600" /> Create Task
            </button>
            <button onClick={() => navigate(`/wiki/search?q=${encodeURIComponent(field.name)}`)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors">
              <BookOpen size={14} className="text-blue-600" /> View in Wiki
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  field, statusClass, showChart, chartData, chartRef, costData, rotation,
}: {
  field: Field; statusClass: string; showChart: boolean;
  chartData: ChartRow[]; chartRef: React.RefObject<HTMLDivElement | null>;
  costData: FieldCostOfProductionType | null; rotation: FieldRotation | null;
}) {
  const totals = costData?.totals;

  // For the stand % overlay, pull production from all lines combined
  const allProduction = costData?.lines.flatMap(l => l.production) ?? [];

  // Build combined chart data with stand % overlay
  const combinedChartData = chartData.map(row => {
    const prod = allProduction.find(p => p.year === row.year);
    return { ...row, Stand: prod?.stand_pct ?? null };
  });
  const hasStandData = combinedChartData.some(d => d.Stand !== null);

  const PHASE_LABELS: Record<string, string> = {
    establishment: 'Establishment',
    topping: 'Topping',
    production: 'Production',
    end_of_life: 'End of Life',
  };

  const PHASE_COLORS: Record<string, string> = {
    establishment: 'bg-blue-100 text-blue-700',
    topping: 'bg-violet-100 text-violet-700',
    production: 'bg-emerald-100 text-emerald-700',
    end_of_life: 'bg-red-100 text-red-700',
  };

  const REPLANT_COLORS: Record<string, string> = {
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    can_delay: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    must_replant: 'bg-red-50 border-red-200 text-red-800',
  };

  return (
    <>
      {/* Rotation & Stand % Banner (rooibos only) */}
      {rotation && (
        <div className="px-4 pt-4 pb-2 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 rounded-md bg-stone-100 text-xs font-bold text-stone-700">
              Year {rotation.rotation_year}
            </span>
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${PHASE_COLORS[rotation.phase] ?? 'bg-stone-100 text-stone-600'}`}>
              {PHASE_LABELS[rotation.phase] ?? rotation.phase}
            </span>
            {rotation.current_stand_pct !== null && (
              <span className={`px-2 py-1 rounded-md text-xs font-bold ${rotation.current_stand_pct >= 70 ? 'bg-emerald-100 text-emerald-700' : rotation.current_stand_pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                <Sprout size={10} className="inline mr-1" />
                Stand {rotation.current_stand_pct}%
              </span>
            )}
          </div>

          {rotation.replant_message && (
            <div className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${REPLANT_COLORS[rotation.replant_status] ?? ''}`}>
              {rotation.replant_status === 'must_replant' ? (
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              ) : rotation.replant_status === 'can_delay' ? (
                <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              )}
              <span>{rotation.replant_message}</span>
            </div>
          )}
        </div>
      )}

      {/* Info Grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <InfoCell label="Farm" value={field.farm_name ?? '—'} />
        <InfoCell label="Code" value={field.code ?? '—'} />
        <InfoCell label="Area" value={`${field.area_ha.toFixed(1)} ha`} />
        <InfoCell label="Planted" value={field.planted_year ?? '—'} />
        <div>
          <p className="text-xs text-stone-500 mb-0.5">Status</p>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusClass}`}>
            {field.status}
          </span>
        </div>
        <InfoCell label="Irrigation" value={field.irrigation_type ?? 'Dryland'} />
      </div>

      {/* Cost Summary Cards */}
      {totals && totals.total_cost > 0 && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard label="Total Cost" value={formatZAR(totals.total_cost)} icon={<DollarSign size={12} />} color="text-red-600" />
            <SummaryCard
              label="Cost/ha"
              value={field.area_ha > 0 ? formatZAR(Math.round(totals.total_cost / field.area_ha)) : '—'}
              icon={<Layers size={12} />}
              color="text-amber-600"
            />
            <SummaryCard
              label="Cost/kg"
              value={totals.total_yield_kg > 0 ? formatZAR(totals.total_cost / totals.total_yield_kg) : '—'}
              icon={<BarChart3 size={12} />}
              color="text-emerald-600"
            />
          </div>
          {/* Uncategorized warning chip */}
          {totals.uncategorized_cost > 0 && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle size={12} className="flex-shrink-0" />
              <span>Uncategorized: {formatZAR(totals.uncategorized_cost)} — transactions with no active usage period.</span>
            </div>
          )}
        </div>
      )}

      {/* Production Chart with Stand % overlay */}
      {showChart && (
        <div ref={chartRef} className="px-4 pb-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">Production History</h3>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={combinedChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#78716c' }} tickFormatter={(val: number) => (val % 5 === 0 ? String(val) : '')} interval={0} />
              <YAxis yAxisId="yield" tick={{ fontSize: 10, fill: '#78716c' }} width={40} />
              {hasStandData && (
                <YAxis yAxisId="stand" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: '#d97706' }} width={30} tickFormatter={(v: number) => `${v}%`} />
              )}
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e5e4' }}
                formatter={(value, name) => {
                  if (name === 'Stand') return value != null ? [`${value}%`, 'Stand %'] : ['—', 'Stand %'];
                  return [`${Number(value).toLocaleString()} kg`, String(name)];
                }}
                labelFormatter={label => `Year: ${label}`}
                cursor={{ fill: 'rgba(5, 150, 105, 0.08)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="yield" dataKey="Estimated" fill="#d6d3d1" radius={[2, 2, 0, 0]} />
              <Bar yAxisId="yield" dataKey="Actual" fill="#059669" radius={[2, 2, 0, 0]} />
              {hasStandData && (
                <Line yAxisId="stand" type="monotone" dataKey="Stand" stroke="#d97706" strokeWidth={2} dot={{ r: 3, fill: '#d97706' }} connectNulls />
              )}
            </ComposedChart>
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
            {field.field_notes.map(note => (
              <li key={note.id} className="rounded-lg p-3 bg-stone-50">
                {note.title && <p className="text-sm font-medium text-stone-800 mb-0.5">{note.title}</p>}
                {note.body && <p className="text-xs text-stone-600 line-clamp-2">{note.body}</p>}
                <p className="text-xs text-stone-400 mt-1">{formatDate(note.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-400">No notes yet.</p>
        )}
      </div>
    </>
  );
}

// ─── Inputs Tab ───────────────────────────────────────────────────────────────

function InputsTab({
  inputs, taskInputs, loading,
}: {
  inputs: FieldInputTransaction[]; taskInputs: FieldTaskInput[]; loading: boolean;
}) {
  if (loading) return <LoadingState />;

  const hasData = inputs.length > 0 || taskInputs.length > 0;

  if (!hasData) {
    return <EmptyState icon={<Droplets size={24} />} message="No inputs recorded for this field" />;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Inventory transactions (actual products applied) */}
      {inputs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-stone-700 mb-2">Products Applied</h3>
          <div className="space-y-2">
            {inputs.map(input => (
              <div key={input.id} className="rounded-lg border border-stone-100 p-3 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-stone-800">{input.product_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_COLORS[input.category] ?? 'bg-stone-100 text-stone-600'}`}>
                    {input.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-500">
                  <span>{input.quantity} {input.unit_of_measure}</span>
                  {input.total_cost != null && <span className="text-red-600 font-medium">{formatZAR(input.total_cost)}</span>}
                  <span className="ml-auto">{formatDate(input.date)}</span>
                </div>
                {input.notes && <p className="text-xs text-stone-400 mt-1">{input.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task-linked inputs */}
      {taskInputs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-stone-700 mb-2">Task Inputs</h3>
          <div className="space-y-2">
            {taskInputs.map(ti => (
              <div key={ti.id} className="rounded-lg border border-stone-100 p-3 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-stone-800">{ti.product_name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ti.task_status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {ti.task_status}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mb-1">{ti.task_title}</p>
                <div className="flex items-center gap-3 text-xs text-stone-500">
                  {ti.rate && <span>{ti.rate} {ti.rate_unit}</span>}
                  {ti.total_applied && <span>→ {ti.total_applied} {ti.total_unit}</span>}
                  {ti.total_cost != null && <span className="text-red-600 font-medium">{formatZAR(ti.total_cost)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Labour Tab ───────────────────────────────────────────────────────────────

function LabourTab({ labour, loading }: { labour: FieldLabourEntry[]; loading: boolean }) {
  if (loading) return <LoadingState />;

  if (labour.length === 0) {
    return <EmptyState icon={<Clock size={24} />} message="No labour entries for this field" />;
  }

  // Group by employee
  const byEmployee = labour.reduce<Record<string, { name: string; role: string; entries: FieldLabourEntry[]; totalHours: number }>>((acc, entry) => {
    if (!acc[entry.employee_id]) {
      acc[entry.employee_id] = { name: entry.employee_name, role: entry.employee_role, entries: [], totalHours: 0 };
    }
    acc[entry.employee_id].entries.push(entry);
    acc[entry.employee_id].totalHours += entry.hours_worked || 0;
    return acc;
  }, {});

  const totalHours = labour.reduce((sum, e) => sum + (e.hours_worked || 0), 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">Labour Summary</h3>
        <span className="text-sm font-bold text-stone-900">{totalHours.toFixed(1)} hrs total</span>
      </div>

      {Object.values(byEmployee).map(emp => (
        <div key={emp.name} className="rounded-lg border border-stone-100 p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-stone-800">{emp.name}</p>
              <p className="text-xs text-stone-500">{emp.role}</p>
            </div>
            <span className="text-sm font-bold text-emerald-700">{emp.totalHours.toFixed(1)} hrs</span>
          </div>
          <div className="space-y-1">
            {emp.entries.slice(0, 5).map(entry => (
              <div key={entry.id} className="flex items-center justify-between text-xs text-stone-500">
                <span>{entry.activity_type?.replace('_', ' ')}</span>
                <span>{entry.hours_worked}h · {formatDate(entry.date)}</span>
              </div>
            ))}
            {emp.entries.length > 5 && (
              <p className="text-xs text-stone-400">+{emp.entries.length - 5} more entries</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Costs Tab ────────────────────────────────────────────────────────────────

/** One section per CopLine — shows per-usage breakdown with its own metrics and sub-lists. */
function CopLineSection({ line }: { line: CopLine }) {
  const usageLabel = line.usage.charAt(0).toUpperCase() + line.usage.slice(1).replace(/_/g, ' ');

  return (
    <div className="rounded-lg border border-stone-100 bg-white p-3 space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">{usageLabel}</span>
        <span className="text-xs text-stone-500">{line.area_ha.toFixed(1)} ha</span>
      </div>

      {/* Per-line metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <p className="text-stone-500 mb-0.5">Total Cost</p>
          <p className="font-bold text-stone-900">{formatZAR(line.total_cost)}</p>
        </div>
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <p className="text-stone-500 mb-0.5">Cost / ha</p>
          <p className="font-bold text-stone-900">{formatZAR(line.cost_per_ha)}</p>
        </div>
        {line.actual_yield_kg > 0 && (
          <div className="rounded bg-stone-50 px-2 py-1.5">
            <p className="text-stone-500 mb-0.5">Yield (actual)</p>
            <p className="font-bold text-stone-900">{line.actual_yield_kg.toLocaleString()} kg</p>
          </div>
        )}
        {line.cost_per_kg != null && (
          <div className="rounded bg-stone-50 px-2 py-1.5">
            <p className="text-stone-500 mb-0.5">Cost / kg</p>
            <p className="font-bold text-stone-900">{formatZAR(line.cost_per_kg)}</p>
          </div>
        )}
      </div>

      {/* Cost breakdown bar */}
      {line.total_cost > 0 && (
        <div className="space-y-1.5">
          {[
            { name: 'Inputs', value: line.total_input_cost, color: '#059669' },
            { name: 'Task Inputs', value: line.total_task_input_cost, color: '#0d9488' },
            { name: 'Labour', value: line.total_labour_cost, color: '#d97706' },
          ].filter(c => c.value > 0).map(item => {
            const pct = (item.value / line.total_cost) * 100;
            return (
              <div key={item.name}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-stone-500">{item.name}</span>
                  <span className="text-stone-700 font-medium">{formatZAR(item.value)} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Line-level warnings */}
      {line.warnings.length > 0 && (
        <div className="space-y-1">
          {line.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
              <AlertTriangle size={10} className="flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CostsTab({
  costData, field, loading,
}: {
  costData: FieldCostOfProductionType | null;
  field: Field; loading: boolean;
}) {
  if (loading) return <LoadingState />;

  if (!costData || costData.totals.total_cost === 0) {
    return <EmptyState icon={<DollarSign size={24} />} message="No cost data available for this field" />;
  }

  const { totals, lines, coverage } = costData;
  const areaHa = field.area_ha || 1;

  // Per-year production aggregated across all lines for yield chart
  const allProduction = lines.flatMap(l => l.production);
  const yearlyData = allProduction
    .filter(p => p.actual_yield_kg != null && p.actual_yield_kg > 0)
    .sort((a, b) => a.year - b.year)
    .slice(-5)
    .map(p => ({
      year: p.year,
      yield_kg: p.actual_yield_kg ?? 0,
      yield_per_ha: Math.round((p.actual_yield_kg ?? 0) / areaHa),
    }));

  return (
    <div className="p-4 space-y-4">
      {/* Top-level totals */}
      <div>
        <h3 className="text-sm font-semibold text-stone-700 mb-3">Cost of Production</h3>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Total Cost" value={formatZAR(totals.total_cost)} sub="all usages combined" />
          <MetricCard label="Cost / ha" value={formatZAR(Math.round(totals.total_cost / areaHa))} sub={`${areaHa.toFixed(1)} ha`} />
          <MetricCard
            label="Cost / kg"
            value={totals.total_yield_kg > 0 ? formatZAR(totals.total_cost / totals.total_yield_kg) : '—'}
            sub="variable cost"
          />
          <MetricCard label="Total Yield" value={`${totals.total_yield_kg.toLocaleString()} kg`} sub={`${(totals.total_yield_kg / areaHa).toFixed(0)} kg/ha`} />
        </div>
      </div>

      {/* Uncategorized warning */}
      {totals.uncategorized_cost > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <AlertTriangle size={12} className="flex-shrink-0" />
          <span>Uncategorized: {formatZAR(totals.uncategorized_cost)} — transactions with no active usage period.</span>
        </div>
      )}

      {/* Per-usage sections */}
      {lines.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-stone-700 mb-2">By Usage</h3>
          <div className="space-y-3">
            {lines.map((line, idx) => (
              <CopLineSection key={`${line.usage}-${idx}`} line={line} />
            ))}
          </div>
        </div>
      )}

      {/* Yield per Ha (last 5 years) */}
      {yearlyData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-stone-700 mb-3">Yield / ha (last 5 years)</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={yearlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#78716c' }} />
              <YAxis tick={{ fontSize: 10, fill: '#78716c' }} width={35} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(value) => [`${Number(value).toLocaleString()} kg/ha`, 'Yield']} />
              <Bar dataKey="yield_per_ha" fill="#059669" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Coverage footnote */}
      <p className="text-[10px] text-stone-400 leading-relaxed">
        Excludes: {coverage.excludes.length > 0 ? coverage.excludes.join(', ') : 'none'}.
        {' '}Denominator: {coverage.denominator}.
        {coverage.notes ? ` ${coverage.notes}` : ''}
      </p>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-stone-500 mb-0.5">{label}</p>
      <p className="text-sm text-stone-800 font-medium">{value}</p>
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-lg bg-stone-50 p-2.5">
      <div className="flex items-center gap-1 mb-1">
        <span className={color}>{icon}</span>
        <p className="text-[10px] text-stone-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-stone-100 p-3 bg-white">
      <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold text-stone-900">{value}</p>
      <p className="text-[10px] text-stone-400 mt-0.5">{sub}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="p-4 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 bg-stone-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-stone-400">
      {icon}
      <p className="text-sm mt-2">{message}</p>
    </div>
  );
}
